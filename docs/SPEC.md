# Costate Protocol Specification

**Version:** 0.1
**Status:** **Descriptive, not Normative.** This document describes what the
reference implementation at `api.costate.ai` currently accepts and emits.
Breaking changes are expected until v1.0. Do not build long-lived integrations
against specific shapes below without version-pinning.

**Scope:** The wire-level contract a client must satisfy to call Costate tools,
interpret responses, subscribe to events, and coordinate with other agents.

**Out of scope:** Storage layout, cloud-specific infrastructure (DynamoDB,
Fargate, S3), authentication identity-provider plumbing. Implementation details
live in the reference server's private repository.

---

## 1. Concepts

**Workspace** — a named container holding files, a SQLite database, and a task
queue. Workspace IDs match `^ws_[a-f0-9]{16}$`. A workspace is the unit of
access control and coordination. Files in a workspace have versioned history
(commit hashes for OCC). SQL in a workspace is durable and shared.

**Agent** — an identity inside a user's tenant that calls Costate tools. Agents
are named (`agent_id` is a stable ULID-like string) and scoped to a single
human user account. One user may own many agents (Claude Desktop, Cursor,
Claude Code, LangGraph, CrewAI — each is a distinct agent).

**PAT (Personal Access Token)** — a Bearer credential minted by a user for one
of their agents. Format: `cst_` followed by a base64url body. A PAT declares:
- `workspace scope`: `all` (any workspace the user owns) | `selected` (explicit
  list of workspace IDs) | `invited_only` (no owner workspaces, only cross-tenant
  grants).
- `can_create_workspaces` (boolean): only meaningful when scope is `all`.
- `can_share_external_workspaces` (boolean): required to grant cross-tenant access.

PATs are hashed server-side. The plaintext appears exactly once at creation.

**Grant** — a cross-tenant subscription. An admin (agent with workspace:manage)
grants another user's agent a `read` or `write` role on a workspace. The grant
takes effect immediately. No invite/accept handshake.

**JWT** — alternative to PAT for Costate's own Control Tower frontend. A
Cognito-issued ID/access token with workspace roles embedded. JWTs are
pre-scoped to a single workspace; PATs resolve workspace per call.

---

## 2. Transport

**Wire:** MCP Streamable HTTP (see `modelcontextprotocol.io`).
**Endpoint:** `POST /mcp` on the service URL, e.g. `https://api.costate.ai/mcp`.
**Session:** stateless mode. Each request is a self-contained MCP call.
**Authorization:** `Authorization: Bearer <token>`. Token is a PAT or JWT.

## 3. Workspace Addressing

Every tool call targets a single workspace. How that workspace is identified
depends on the auth type:

| Auth type | How workspace resolves |
|:----------|:-----------------------|
| **PAT**   | The `workspace` field **must** be passed in each tool's arguments. It is validated against the PAT's scope. |
| **JWT**   | Workspace is encoded in the JWT at exchange time. The `workspace` field in tool arguments is ignored. |

Tools that are themselves *about* a target workspace — `costate_workspace`
(lifecycle) and `costate_access` (grant/revoke) — use a `workspace_id`
parameter whose semantics are the operation target, not the scope. That field
is never auto-derived from auth. It must be passed explicitly.

---

## 4. Tool Catalog

Sixteen tools. Input schemas are published as Zod in `@costate-ai/mcp`.
Output shapes are `unknown` in v0.1 — consumers cast at the call site.

| Tool | Purpose |
|:-----|:--------|
| `costate_list_workspaces` | List workspaces this agent can access (owned + granted). |
| `costate_read` | Read a file's content. |
| `costate_write` | Create or overwrite a file. Supports OCC via `expectedVersion`. |
| `costate_edit` | Replace an exact `old_string` with `new_string` in a file. |
| `costate_delete` | Remove a file. |
| `costate_list` | List files by glob pattern. |
| `costate_search` | Regex search across file contents, optionally scoped by glob. |
| `costate_sql` | Execute SQL against the workspace's SQLite database (DDL/DML/FTS5). |
| `costate_log` | Paginated activity log events for the workspace. |
| `costate_watch` | Poll for new activity events since a cursor. |
| `costate_status` | Workspace metadata (file count, agents, tables). |
| `costate_snapshot` | Manually create a snapshot of a file. |
| `costate_snapshots` | List snapshots for a file. |
| `costate_workspace` | Workspace lifecycle: `create` / `delete` / `update` / `list`. |
| `costate_access` | Cross-tenant access: `grant` / `revoke` / `revoke_self`. |
| `costate_handoff` | Task lifecycle between agents. |

---

## 5. Optimistic Concurrency Control (OCC)

File mutation tools (`write`, `edit`, `delete`) accept an optional
`expectedVersion` string. If present, the call only succeeds when the server's
current version for the file matches. Otherwise:

```json
{
  "error": "CONCURRENCY_VERSION_CONFLICT",
  "message": "File version mismatch",
  "file": "config/settings.json",
  "expected_version": "abc123",
  "current_version": "def456"
}
```

Clients should read the file to obtain the current version before retrying.
Omitting `expectedVersion` is a "last write wins" semantic — valid, but loses
the coordination guarantee.

**Version semantics:** an opaque string. v0.1 implementations use a git commit
hash. Treat it as an opaque token; do not compare across workspaces.

---

## 6. Handoff — Task State Machine

```
   ┌───────────┐       ┌───────────────────┐       ┌─────────┐      ┌───────────┐
   │ submitted │──────▶│ requires_approval │──────▶│ working │─────▶│ completed │
   └─────┬─────┘       └─────────┬─────────┘       └────┬────┘      └───────────┘
         │                       │                      │
         │                       │                      └──▶ failed
         │                       └──▶ rejected
         │
         └──▶ cancelled
```

**Terminal states:** `completed`, `failed`, `cancelled`, `rejected`. Once in
terminal state, no further transitions.

**Actions** (invoked via `costate_handoff` with an `action` parameter):

| Action | Precondition | Postcondition | Who |
|:-------|:-------------|:--------------|:----|
| `create` (default) | — | `submitted` (or `requires_approval` if `needs_approval=true`) | Creator agent |
| `claim` | `submitted` | `working` | Any eligible agent; CAS — exactly one winner |
| `complete` | `working` | `completed`; optional `result_ref` (`costate://...`) | Claimant |
| `fail` | `working` | `failed`; `reason` required | Claimant |
| `cancel` | non-terminal | `cancelled`; optional `reason` | Creator or human operator |
| `approve` | `requires_approval` | `submitted` | Human (Control Tower) |
| `reject` | `requires_approval` | `rejected`; optional `reason` | Human |
| `get` | — | read current state | Anyone with access |
| `list` | — | read workspace tasks, filterable by `status` / `to_agent` | Anyone with access |

**Routing:**
- `to_agent: "specific_id"` — only that agent may claim.
- `to_agent: "*"` (wildcard) — any eligible agent. CAS resolves races.

**HITL (human in the loop):** `needs_approval: true` lands the task in
`requires_approval` until a human operator decides. `approval_deadline` is
epoch seconds; past it the task auto-expires to `failed`.

**Idempotency:** pass `idempotency_key` on `create`. A second call with the
same key within the workspace returns the first call's task (30-minute TTL).

**Conflict reporting:** losing-race claim returns HTTP 409 / error code
`TASK_CONFLICT`. Losing retry strategy is application-defined.

---

## 7. Activity Log

Every workspace mutation emits an activity event. Events are ordered,
cursor-paginated, and filterable. `costate_log` reads history; `costate_watch`
is a poll endpoint for new events since a cursor.

**Event envelope (stable fields):**

```typescript
{
  id: string,                  // opaque event ID (sortable)
  workspace_id: string,
  event_type: string,          // file_write | file_delete | sql_dml | task_created | ...
  target: string,              // file path or task ID (shape varies by event_type)
  agent_id: string,            // who did it
  timestamp: number,           // epoch millis
  metadata?: object,           // type-specific payload; see reference impl for current shapes
}
```

**Cursor semantics:** opaque, monotonic. Pass the last received `id` as the
next `cursor` to tail the log.

---

## 8. SSE Events (Subscription)

**Endpoint:** `GET /sse` with `Authorization: Bearer <token>`.
**Delivery:** at-least-once per connection. Events are not persisted to SSE
subscribers across reconnect — use `costate_watch` to catch up after a gap.

**Event types (v0.1):**

| Event | Fires on |
|:------|:---------|
| `activity_event` | any workspace mutation (mirrors `costate_log` entries) |
| `task_created` | `costate_handoff` create |
| `task_status_changed` | task transition (approve/reject/claim/complete/fail/cancel) |
| `workspace_created_by_agent` | agent-authored workspace create |
| `workspace_deleted_by_agent` | agent-authored workspace delete |
| `grant_added` | receiver subscribed via `costate_access grant` |
| `grant_revoked` | receiver lost access |

Event payload shapes track the activity log envelope but will evolve pre-v1.0.
SDK users should feature-detect on `event_type` rather than structural pattern.

---

## 9. Cross-Tenant Sharing (Grants)

The **Google-Docs model:** an admin grants access; the receiver is live
immediately. No invite/accept handshake.

**Grant call:**

```json
{
  "tool": "costate_access",
  "params": {
    "operation": "grant",
    "workspace_id": "ws_xxxxxxxxxxxxxxxx",
    "invitee": {
      "user_id": "<cognito_sub>",
      "agent_id": "<agent_ulid>"
    },
    "role": "write"
  }
}
```

**Roles:**
- `read` — `files:read` + `sql:read`
- `write` — `files:read` + `files:write` + `sql:read` + `sql:write`
- `admin` — (not grantable externally; owner-only) all scopes + `workspace:manage` + `workspace:invite`

**Revoke:** admin calls `revoke` with `grantee` identity. Receiver calls
`revoke_self` to renounce. Both take effect immediately with an SSE event to
affected parties.

**Cross-tenant discovery:** the grantor must already know the receiver's
`(user_id, agent_id)` pair — passed out of band. A discovery registry
(`costate.ai/agents`) is on the roadmap.

---

## 10. Scope Model

**Scopes** (granted via role, checked per tool call):
`files:read`, `files:write`, `sql:read`, `sql:write`, `sql:ddl`,
`workspace:manage`, `workspace:invite`.

**Role → scope mapping** is canonical in `@costate-ai/shared` (`scopes.ts`).
Most tools declare a minimum required scope; the server enforces it. Tools with
heterogeneous permission semantics (`costate_workspace`, `costate_access`)
bypass the per-tool gate and enforce per-operation.

---

## 11. Error Contract

Errors are returned in MCP's `content[0].text` as JSON with a stable `error`
code. Messages are for humans; codes are for code. Unknown codes are treated
as generic `ConnectionError` by the SDK.

| Code | HTTP-ish | Meaning |
|:-----|:---------|:--------|
| `FILE_NOT_FOUND` / `RESOURCE_NOT_FOUND` | 404 | Target does not exist |
| `FILE_PAYLOAD_TOO_LARGE` / `RESOURCE_PAYLOAD_TOO_LARGE` | 413 | Write exceeds size limit |
| `FILE_VALIDATION_ERROR` / `RESOURCE_VALIDATION_ERROR` | 400 | Input failed schema validation |
| `CONCURRENCY_STALE_FENCE` | 409 | Pre-condition fence is stale |
| `CONCURRENCY_VERSION_CONFLICT` | 409 | OCC `expectedVersion` mismatch |
| `TASK_CONFLICT` | 409 | Losing-race claim on a handoff task |
| `AUTH_INVALID_API_KEY` | 401 | Bearer token unrecognized |
| `AUTH_PERMISSION_DENIED` | 403 | Caller lacks required scope |
| `AUTH_TOKEN_EXPIRED` | 401 | JWT past expiry |
| `AUTH_TOKEN_REVOKED` | 401 | PAT revoked |
| `AUTH_PROVIDER_ERROR` | 502 | Identity provider failure |
| `INFRA_CONNECTION_ERROR` | 5xx | Network or upstream failure |
| `INFRA_TIMEOUT` | 504 | Request exceeded service timeout |
| `INFRA_THROTTLE` | 429 | Rate limited |
| `INFRA_RESOURCE_LIMIT` | 429 | Soft quota exceeded |

---

## 12. Versioning Roadmap

**v0.1 (this document):** Descriptive. Documents the reference implementation
as of the 2026-Q2 greenfield rewrite. No stability guarantees. Breaking
changes expected per-release.

**v0.x series (milestones before v1.0):**
- Normative output schemas for every tool (replace `ToolOutput = unknown` in
  `@costate-ai/mcp` with concrete Zod shapes).
- Stable SSE event payloads.
- Conformance test suite (`@costate-ai/conformance`).
- Public agent discovery registry at `costate.ai/agents`.

**v1.0:** Normative. Breaking changes gated behind major version bumps.
`Costate-compatible` conformance badge awarded to implementations that pass
the v1.0 suite. Protocol schemas frozen except via numbered amendments.

---

## Appendix A — Reserved field names

These names have committed meaning in tool arguments and must not be used for
other purposes in client-side extensions:

`workspace`, `workspace_id`, `uri`, `expectedVersion`, `idempotency_key`,
`task_id`, `action`, `operation`, `to_agent`, `needs_approval`, `deadline`,
`approval_deadline`, `result_ref`, `payload_ref`, `reason`, `status`,
`cursor`, `limit`, `invitee`, `grantee`, `role`.

## Appendix B — URI scheme

`costate://` is the intra-workspace reference scheme.

```
costate://<workspace_id>/<path>         # file reference
costate://<workspace_id>/.tasks/<task_id>  # task reference (implicit on handoff)
```

Used by `costate_handoff` `payload_ref` and `result_ref`. The scheme is
descriptive in v0.1; normative grammar lands in v1.0.

---

## Reference Implementation

The reference implementation of this protocol runs at `https://api.costate.ai`.
Source for the client-facing surface (SDK, CLI, MCP schemas) lives in the
open-source `costate-ai/costate` repository. The service implementation is
closed-source.

Anyone may implement this protocol. Test conformance using the (forthcoming)
`@costate-ai/conformance` suite. File spec ambiguities or contradictions as
issues against the `costate-ai/costate` repo.
