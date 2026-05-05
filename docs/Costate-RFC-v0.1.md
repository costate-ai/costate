# Costate

**Version:** 0.1.1-draft
**Status:** Working Draft — All sections (1–8) drafted normatively; companion RFCs forthcoming for §7 capability specs
**Date:** 2026-05-04

**Changes since 0.1.0-draft:**
- §3.7 (new) **Agent Discovery**: hosts MUST expose a workspace-scoped
  agent directory so a sender's client can pick `to_agent` for a task.
  Hosts SHOULD NOT implement server-side automated routing rules —
  routing decisions belong to the requester's client.
**Editors:** TBD

## Abstract

The Costate defines an interoperable layer for
**persistent shared state** and **cross-tenant task coordination** between AI
agents. Costate sits above existing agent communication protocols: where the
Model Context Protocol (MCP) defines how an agent invokes tools and the
Agent2Agent (A2A) protocol defines how agents exchange messages, Costate defines
the data and lifecycle primitives those agents coordinate around — workspaces,
files, tasks, grants, and activity events — across organizational trust
boundaries.

Costate is implementation-neutral. A conforming **Costate host** MAY back its
workspaces with any storage technology; what is normative is the wire
contract, the URI scheme, the operation semantics, and the error model
defined herein.

## Status of This Document

This document is a working draft of the Costate. It is
intended for submission to a recognized standards body (e.g., the Linux
Foundation Agentic AI Foundation) as a complementary specification to MCP and
A2A. Implementers SHOULD expect breaking changes prior to v1.0.

A reference implementation exists at <https://github.com/costate-ai/costate>;
its existence does not constrain conforming implementations. Where the
reference implementation diverges from this specification, the specification
governs.

## Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC 2119] and [RFC 8174] when, and only when,
they appear in all capitals.

Field names are written in `monospace`. Concrete examples use JSON unless
otherwise noted. Protocol primitives are introduced in §1, addressed in §2,
and operated on in §3. Authentication, trust negotiation, compliance
behaviors, and security considerations are reserved for §§4–7 (forthcoming).

---

## 1. Terminology

### 1.1 Host

A **Costate host** is a network endpoint that serves one or more workspaces over
HTTPS. A host is identified by a DNS name and an optional port (default
`443`). Hosts MUST present a valid TLS certificate for the DNS name they
serve.

The reserved host identifier `localhost` is permitted for development. Hosts
MUST NOT serve production workspaces over plaintext HTTP.

### 1.2 Workspace

A **workspace** is a named, persistent container of state shared by one or
more agents. Each workspace has:

- A globally addressable **workspace URI** of the form
  `costate://<host>/<workspace_id>` (see §2.1).
- A unique `workspace_id` opaque to clients but stable for the workspace's
  lifetime.
- A human-readable `name` (UTF-8, max 64 octets, REQUIRED).
- A creation timestamp.
- An owner identity (a principal per §1.5).
- Zero or more grants (see §1.7).
- A collection of files (see §1.3) and a collection of tasks (see §1.4).

Workspaces are the **unit of access control and coordination**. Agents
operate on a workspace by addressing it via its URI; an agent MAY hold
credentials for workspaces on multiple hosts simultaneously.

### 1.3 File

A **file** is an addressable, versioned blob within a workspace. Each file
has:

- A workspace-relative `path` consisting of UTF-8 segments joined by `/`,
  matching the regular expression `^[^/].*[^/]$` (no leading or trailing
  slash) and not exceeding 1024 octets.
- A `content_type` media type (RFC 9110), default `application/octet-stream`.
- A `version` opaque to clients but used for optimistic concurrency control
  (see §3.2.4). A conforming host MAY use SHA-256 of content, monotonic
  integer, ULID, or any other stable token; clients treat it as opaque.
- A `size` in octets.
- A `created_at` and `updated_at` timestamp (RFC 3339).
- A `created_by` agent identity and `updated_by` agent identity.

Files MAY contain arbitrary binary content. A host SHOULD support files up
to at least 16 MiB; behavior beyond this size is implementation-defined.

### 1.4 Task

A **task** is a unit of work coordinated between agents through a workspace.
Costate tasks are designed to be **A2A v1.0 compatible**: the lifecycle states
(`submitted`, `working`, `completed`, `failed`, `cancelled`, `rejected`)
match A2A's task states, and the wire shape can be serialized as an A2A
Task message (see §3.3.11). Costate extends A2A with one additional state,
`requires_approval`, for cross-tenant human-in-the-loop authorization
which A2A v1.0 does not specify.

The defining difference from A2A: A2A tasks are **point-to-point**
(agent A directly addresses agent B over an HTTP endpoint). Costate tasks are
**workspace-mediated** — they live in a shared workspace, multiple agents
may race to claim them atomically, and they reference workspace files for
input and output. Costate tasks are A2A's task model translated into a
shared-substrate setting.

Informally, a Costate task is often called a "handoff" in product-level prose.
The protocol primitive is **task**; the operations in §3.3 use that name
exclusively.

Each task has:

- A workspace-scoped `task_id` (lexicographically sortable, RECOMMENDED ULID
  per [RFC 4122 §4.4 era]).
- A `status` from the state machine defined in §3.3.1.
- A `from_agent` identity (the creator).
- A `to_agent` selector: an agent identity, the wildcard `"*"`, or the
  null sentinel `null` (see §3.3.4 for routing semantics).
- A human-readable `task` description (UTF-8, max 8192 octets, REQUIRED).
- An optional `payload_ref`: a Costate URI referencing input data. **The
  referenced resource MUST live within the same workspace as the task.**
  Cross-workspace and cross-host references are out of scope for the v0.1
  base profile; callers needing to share data across workspaces SHOULD
  replicate the data into the target workspace first.
- An optional `result_ref`: a Costate URI referencing output data, set on
  completion. **Same constraint as `payload_ref`** — MUST live within
  the same workspace as the task.
- An optional `deadline` (RFC 3339 timestamp). After the deadline, the task
  MUST transition to `failed` if not already terminal.
- An optional `needs_approval` flag (boolean, default `false`). If `true`,
  the task MUST pause at `requires_approval` until a principal with
  `tasks:admin` scope (see §3.5) approves or rejects it.
- A `created_at` timestamp and zero or more lifecycle event timestamps
  (`claimed_at`, `completed_at`, etc.).

Tasks are the protocol's mechanism for **lifecycle-bearing** work — work
where the originator needs to know when it is done, who did it, and whether
it succeeded. State that does not require lifecycle semantics SHOULD be
modeled as files, not tasks.

### 1.5 Principal

A **principal** is the identity authorized to issue access tokens, create
agents, and act directly on workspaces. In v0.1 a principal is always a
human user account at a host; future versions may admit organizational or
service-account principals.

Principal identities are URIs of the form
`costate://<host>/principals/<principal_id>` where `principal_id` is an
opaque host-assigned identifier matching `^[A-Za-z0-9_-]{1,128}$`. Hosts
typically derive the identifier from an OIDC subject claim or a stable
internal account ID; clients MUST treat it as opaque.

A principal MAY have any number of agents (§1.6) acting on their behalf.
A principal MAY also act directly on a workspace using a human-session
credential (§4.11). **Both modes are first-class.** Activity events
(§1.8) record the principal in every state-change event so audit trails
can attribute actions to the responsible human, regardless of whether an
agent or a direct session performed the call.

Principals are the load-bearing identity in Costate. The canonical
collaboration pattern is: *multiple principals, each owning one or more
agents, all editing the same workspace through their respective agents*,
with humans occasionally stepping in directly for HITL approvals or
manual interventions.

### 1.6 Agent

An **agent** is a non-human identity owned by exactly one principal
(§1.5). A principal MAY own any number of agents — typically one per AI
client (Claude Desktop, Cursor, Claude Code, a CrewAI worker, etc.) —
each with its own credential and scope set.

Agent identities are URIs of the form
`costate://<host>/agents/<agent_id>` where `agent_id` is an opaque,
host-assigned identifier matching `^[a-z0-9_-]{1,64}$` and globally
unique on the host. Agent URIs are NOT workspace-scoped: a single agent
may operate across any workspace its owning principal can access. The
host maintains an internal mapping from `agent_id` to owning
`principal_id`; this mapping is private to the host but is reflected in
activity events (§1.8) and in the §3.5 scope-resolution flow.

Agent identities MUST be stable across renames; a host that permits
agent renames MUST preserve the underlying `agent_id`. Agent ownership
MUST NOT transfer between principals — a transfer is modeled as a new
agent owned by the receiving principal.

### 1.7 Grant

A **grant** is the protocol's primitive for **cross-tenant access**. A grant
binds:

- A target workspace URI.
- A grantee identifier (typically an email address or another host's
  principal URI per §1.5).
- A set of scopes (see §3.5) the grantee may exercise on the workspace.
- An optional expiration timestamp.
- The granter's identity.

Grants are the **only** mechanism by which a principal (and the agents
they own) on host A may operate on a workspace on host B. Authentication
and trust negotiation across hosts are specified in §4; §1.7 establishes
only that the grant is the named primitive.

### 1.8 Activity Event

An **activity event** is an immutable record of a state change in a
workspace. Each event has:

- A workspace-scoped, lexicographically sortable `event_id`.
- A `timestamp` (RFC 3339).
- An `event_type` enumeration (see §3.4.1).
- An `actor` URI identifying who or what performed the action. MUST be
  either an agent URI (§1.6) or a principal URI (§1.5). When the request
  was made by an agent under §4.2 AAT auth, `actor` is the agent URI;
  when made directly by a human under §4.11 human-session auth, `actor`
  is the principal URI.
- An `on_behalf_of` URI, OPTIONAL. When `actor` is an agent URI, this
  SHOULD be set to the owning principal's URI for audit clarity. When
  `actor` is a principal URI (direct human action), this field is
  absent. Consumers MUST NOT assume the field is present on every event.
- A `target` URI identifying the resource the event concerns.
- A `metadata` JSON object whose schema is event-type-specific.

Activity events MUST NOT be mutated after creation. A conforming host MAY
expire events after a retention window (RECOMMENDED minimum: 90 days);
hosts that advertise compliance with EU AI Act traceability requirements
(Articles 12, 13) SHOULD preserve events for at least 6 years.

### 1.9 Agent Access Token (AAT)

An **Agent Access Token (AAT)** is the bearer credential by which an agent
authenticates to a host. An AAT is bound to a specific agent identity
(per §1.6), not to a principal — the principal owns the agent; the
agent uses the token. This naming is deliberate: terminology like "Personal
Access Token" (familiar from human-developer ecosystems) misrepresents the
binding, since Costate AATs authenticate non-human callers. Principals
authenticate directly using human-session credentials (§4.11), not AATs.

AATs are opaque strings beginning with the prefix `cst_aat_` followed by
base64url-encoded random bytes (minimum 32 octets of entropy). AATs are
issued by a host to one of its principals on behalf of one of that
principal's agents; cross-host authentication uses grants (see §1.7)
rather than cross-issued AATs.

The complete authentication and authorization model is specified in §4
(forthcoming). Reference implementations transitioning from a prior
"Personal Access Token" naming MAY accept the legacy `cst_pat_` prefix
as a compatibility alias during a deprecation window; new tokens MUST
use `cst_aat_`.

### 1.10 Conforming Implementation

A **Costate host** is a "conforming implementation" if and only if it:

- Serves all REQUIRED operations defined in §3 with the specified semantics.
- Preserves the URI format defined in §2.
- Emits errors using the model defined in §3.6.
- Passes the conformance test suite published alongside this specification
  (location TBD; current path: `costate/packages/conformance/`).

Implementations MAY extend the protocol with custom operations under a
namespace prefix (e.g., `x-acme.*`); custom operations MUST NOT shadow
standard operations.

---

## 2. Data Model

### 2.1 URI Scheme

Costate defines the URI scheme `costate` as follows:

```
costate-uri    = "costate" "://" host [ ":" port ] "/" workspace-id
                 [ "/" resource-path ]
host           = <DNS hostname per RFC 1123>
port           = 1*DIGIT
workspace-id   = 1*( ALPHA / DIGIT / "_" / "-" )
resource-path  = ( "files" "/" file-path )
               / ( "tasks" "/" task-id )
               / ( "agents" "/" agent-id )
               / ( "grants" "/" grant-id )
               / ( "activity" "/" event-id )
file-path      = <UTF-8 path per §1.3>
task-id        = <task ID per §1.4>
agent-id       = <agent ID per §1.6>
principal-id   = <principal ID per §1.5>
grant-id       = <opaque host-assigned ID>
event-id       = <event ID per §1.8>
```

Examples:

```
costate://api.example.com/ws_q4_analysis
costate://api.example.com/ws_q4_analysis/files/data/q4-revenue.csv
costate://api.example.com/ws_q4_analysis/tasks/01KP8GKZE9X3M1Y0RTNVQF7B5W
costate://workers.acme.io/team_sales/agents/closer-bot
```

Costate URIs MUST be canonicalized as follows:

- Host is lowercased.
- Default port (`443`) is omitted.
- File paths are NFC-normalized and not URL-encoded for ASCII characters.
- Comparison of two URIs for equality MUST use the canonical form.

### 2.2 Identifiers

Identifier formats are normative for **interoperability**, not for storage:

| Identifier | Pattern | Scope |
|---|---|---|
| `workspace_id` | `^[a-z0-9_-]{1,64}$` | unique per host |
| `agent_id` | `^[a-z0-9_-]{1,64}$` | unique per workspace |
| `task_id` | ULID (RECOMMENDED) | unique per workspace |
| `event_id` | ULID (RECOMMENDED) | unique per workspace |
| `grant_id` | opaque, host-assigned | unique per workspace |

Hosts MAY use longer identifiers internally provided they exposed them in
the formats above when serializing Costate messages.

### 2.3 Timestamps

All timestamps in Costate are RFC 3339 strings in UTC with millisecond
precision, e.g., `2026-05-01T14:30:00.000Z`. Hosts MUST NOT emit timestamps
with timezone offsets other than `Z`.

### 2.4 Encoding

All Costate request and response bodies are UTF-8 encoded JSON with
`Content-Type: application/json`. Binary file content is transferred as
raw octets in the request/response body of file operations (see §3.2),
NOT base64-encoded JSON.

---

## 3. Operations

### 3.1 Transport

Costate operations are HTTP/1.1 or HTTP/2 requests issued to a host. The
transport is identical for all operation families. Each request MUST
include:

- An `Authorization: Bearer <token>` header with a valid AAT (§1.9), a
  human-session credential (§4.11), or a grant-issued token (per §4).
- A `Content-Type` header for requests with bodies.

Costate-compliant hosts MAY additionally expose operations as MCP tools (see
Appendix A, forthcoming) for convenience. The HTTP form is normative.

### 3.2 File Operations

#### 3.2.1 `file.read`

```
GET /v1/workspaces/{workspace_id}/files/{path}
```

Response 200:

```
Content-Type: <file content_type>
X-Costate-Version: <opaque version token>
X-Costate-Updated-At: <RFC 3339>
X-Costate-Updated-By: <agent URI>

<raw file content>
```

The host MUST return the most recently committed version unless a specific
version is requested via `?version=<token>`.

#### 3.2.2 `file.write`

```
PUT /v1/workspaces/{workspace_id}/files/{path}
Content-Type: <content_type>
If-Match: <expected version token | "*">

<raw content>
```

The `If-Match` header is REQUIRED. Hosts MUST reject requests without
`If-Match` with `400 PRECONDITION_REQUIRED`. The semantics are:

- `If-Match: "*"` — create-or-update: succeeds whether the file exists or
  not.
- `If-Match: <version>` — conditional update: succeeds only if the current
  version matches; otherwise `409 VERSION_MISMATCH`.

Response 200 (or 201 if newly created):

```json
{
  "uri": "costate://api.example.com/ws_q4/files/notes.md",
  "version": "01KP9...",
  "updated_at": "2026-05-01T14:30:00.000Z",
  "updated_by": "costate://api.example.com/ws_q4/agents/alice"
}
```

#### 3.2.3 `file.delete`

```
DELETE /v1/workspaces/{workspace_id}/files/{path}
If-Match: <version | "*">
```

Response: `204 No Content`.

#### 3.2.4 `file.list`

```
GET /v1/workspaces/{workspace_id}/files?prefix=<path>&cursor=<token>
```

Response 200:

```json
{
  "files": [
    { "uri": "costate://...", "size": 1234, "updated_at": "...",
      "version": "..." },
    ...
  ],
  "next_cursor": "<opaque>" | null
}
```

Hosts MUST return at least 50 entries per page when more are available, and
SHOULD return a stable `next_cursor` enabling resumed iteration even under
concurrent writes.

### 3.3 Task Operations

Costate task operations align with A2A v1.0 task lifecycle states where
they correspond, and extend A2A in two places where the shared-substrate
+ HITL model demands behavior A2A v1.0 does not specify. The mapping is
explicit in §3.3.11.

**A2A v1.0 states adopted by Costate** (§3.3.1):
`submitted`, `working`, `input-required`, `completed`, `canceled`*,
`failed`. (* Costate spells the state `cancelled` internally; the
A2A-spelling `canceled` is emitted on the wire when serializing for
A2A consumers per §3.3.11.)

**A2A v1.0 states intentionally NOT adopted:**
- `unknown` — Costate requires every transition to resolve to a
  determinate state. "Unable to determine" surfaces as a `5xx` error
  per §3.6, not as a task state.

**Costate extensions to A2A v1.0:**
- `requires_approval` — for cross-tenant HITL authorization (a human
  reviewer approves before the task proceeds). A2A v1.0 leaves HITL to
  applications; Costate makes it a first-class state.
- `rejected` — terminal state when an HITL reviewer denies the
  request. Pairs with `requires_approval`.

A Costate host SHOULD be able to expose any of its tasks as A2A Task
messages to A2A-only callers, and SHOULD be able to ingest A2A Task
messages and materialize them as Costate tasks. The atomic claim
guarantee (§3.3.3) is the canonical Costate-specific operation that
A2A's point-to-point model cannot provide and that callers SHOULD use
Costate for.

#### 3.3.1 Task State Machine

```
                              submitted
                                 │
                ┌────────────────┼────────────────┐
                ▼                ▼                ▼
       requires_approval      working          cancelled (T)
       (Costate ext.)            │
                │      ┌─────────┼─────────┐
            ┌───┴───┐  ▼         ▼         ▼
            ▼       ▼  ╔═══════════════╗ completed (T)
          rejected approve  input-       failed (T)
          (T,Cost. │       required
           ext.)   ▼         │
                working ◀────┘
                  (provide_input)
```

(T) = terminal state.

**Terminal states (5):** `completed`, `failed`, `cancelled`, `rejected`,
plus naturally any A2A consumer's view of the above.

**Non-terminal states (4):** `submitted`, `requires_approval`,
`working`, `input-required`.

Transitions a host MUST accept:

| From | To | Operation |
|---|---|---|
| (none) | `submitted` | `task.create` (§3.3.2, when `needs_approval=false`) |
| (none) | `requires_approval` | `task.create` (when `needs_approval=true`) |
| `requires_approval` | `submitted` | `task.approve` (§3.3.6) |
| `requires_approval` | `rejected` | `task.reject` (§3.3.6) |
| `submitted` | `working` | `task.claim` (§3.3.3) — atomic |
| `working` | `input-required` | `task.request_input` (§3.3.10) |
| `input-required` | `working` | `task.provide_input` (§3.3.10) |
| `working` | `completed` | `task.complete` (§3.3.5) |
| `working` | `failed` | `task.fail` (§3.3.5) |
| `submitted` | `cancelled` | `task.cancel` (§3.3.5) |
| `requires_approval` | `cancelled` | `task.cancel` |
| `working` | `cancelled` | `task.cancel` |
| `input-required` | `cancelled` | `task.cancel` |

A task MUST NOT transition out of a terminal state. Transitions not in
the table above MUST be rejected with `409 INVALID_TRANSITION`.

#### 3.3.2 `task.create`

```
POST /v1/workspaces/{workspace_id}/tasks
{
  "task": "Analyze Q4 revenue and produce a markdown report",
  "to_agent": "analyst-bob" | "*" | null,
  "payload_ref": "costate://api.example.com/ws_q4/files/data/q4.csv",
  "needs_approval": false,
  "deadline": "2026-05-08T00:00:00.000Z"
}
```

Response 201:

```json
{
  "task_id": "01KP9...",
  "uri": "costate://api.example.com/ws_q4/tasks/01KP9...",
  "status": "submitted" | "requires_approval",
  "from_agent": "costate://api.example.com/ws_q4/agents/alice",
  ...
}
```

The initial status MUST be `requires_approval` if `needs_approval` is true,
otherwise `submitted`.

#### 3.3.3 `task.claim`

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/claim
```

The host MUST perform this transition atomically: if two clients race to
claim the same task, exactly one MUST succeed and the other MUST receive
`409 ALREADY_CLAIMED`. This is REQUIRED — claim races are the canonical
example of why Costate exists rather than agents directly invoking each other.

Response 200:

```json
{ "task_id": "...", "status": "working", "claimed_by": "...",
  "claimed_at": "..." }
```

#### 3.3.4 Routing Semantics for `to_agent`

- A specific agent identity (e.g., `"analyst-bob"`) — only that agent MAY
  claim the task.
- `"*"` — any agent with `tasks:write` scope on the workspace MAY claim.
- `null` — no agent is automatically eligible to claim. The recipient
  principal (resolved by the host) MUST explicitly assign the task to one
  of their agents via §3.3.9 before it is claimable.

#### 3.3.5 `task.complete`, `task.fail`, `task.cancel`

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/{complete|fail|cancel}
{
  "result_ref": "costate://...",   // complete only
  "error": "...",                   // fail only, max 4096 octets
  "reason": "..."                   // cancel only, max 4096 octets
}
```

Only the agent that claimed the task (for `complete`/`fail`) or the
creator/an admin (for `cancel`) MAY invoke these.

#### 3.3.6 `task.approve`, `task.reject`

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/{approve|reject}
{ "comment": "..." }   // OPTIONAL, max 4096 octets
```

Only principals with `tasks:admin` scope (see §3.5) MAY approve or reject.
Approve transitions `requires_approval → submitted`; reject transitions
`requires_approval → rejected`.

#### 3.3.7 `task.get`

```
GET /v1/workspaces/{workspace_id}/tasks/{task_id}
```

Response 200: full task record per §1.4.

#### 3.3.8 `task.list`

```
GET /v1/workspaces/{workspace_id}/tasks?
    status=submitted,working&
    to_agent=analyst-bob&
    cursor=<token>
```

Filters are AND-combined. Hosts MUST support at least the filters
`status` (comma-separated list), `to_agent`, `from_agent`, and pagination
via `cursor` and `limit` (default 50, max 200).

#### 3.3.9 `task.assign`

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/assign
{ "to_agent": "<agent_id>" }
```

Only valid when `to_agent` is currently `null`. Sets `to_agent` to the
specified agent and returns the updated task. Used to resolve
pending-assignment tasks (§3.3.4).

#### 3.3.10 `task.request_input` and `task.provide_input`

These two operations implement the A2A v1.0 `input-required` lifecycle
state. They support multi-turn task refinement: an agent claims a
task, discovers it needs more information from the requester, suspends
work pending that input, and resumes once the input is provided.

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/request_input
{
  "prompt": "Need clarification: should Q4 numbers exclude refunds?"
}
```

Only valid when the task is currently in `working` state and called by
the agent that holds the claim (or an admin). Transitions
`working → input-required`. The `prompt` (REQUIRED, max 4096 octets)
is recorded in metadata so the requester can see what's needed.

```
POST /v1/workspaces/{workspace_id}/tasks/{task_id}/provide_input
{
  "input": "Yes, exclude refunds. See additional doc at costate://.../files/q4-rules.md"
}
```

Only valid when the task is currently in `input-required`. Any
principal with `tasks:write` scope on the workspace MAY provide input
(typically the requester or a delegate). Transitions
`input-required → working`. The `input` (REQUIRED, max 8192 octets) is
recorded in metadata. The original claimant resumes from where it
suspended.

Hosts MAY require that only the original task creator (or `tasks:admin`)
can call `task.provide_input`; this is host-policy, not protocol-level.

Activity emission: `task.request_input` and `task.provide_input` are
both reserved event types in §3.4.1.

#### 3.3.11 A2A Wire-Form Compatibility

Costate tasks MAP cleanly onto A2A v1.0 Task messages, enabling interoperation
with A2A-only agents and consumers. The following field mapping is
REQUIRED for hosts that advertise A2A compatibility:

| Costate field              | A2A v1.0 Task field |
|------------------------|---------------------|
| `task_id`              | `id` |
| `status`               | `status.state` (with state mapping below) |
| `from_agent`           | caller agent identity |
| `to_agent` (specific)  | target agent identity |
| `to_agent` (`"*"`)     | A2A target field omitted; recipient resolves at claim time |
| `to_agent` (`null`)    | A2A target field omitted; assignment required before A2A peers can act |
| `task` (description)   | initial `message.parts[].text` |
| `payload_ref`          | `message.parts[].file.uri` (Costate URI carried verbatim) |
| `result_ref`           | terminal `artifact.parts[].file.uri` |
| `created_at`           | A2A `metadata.created_at` |

State mapping (Costate ↔ A2A v1.0):

| Costate state         | A2A v1.0 state              | Notes |
|-----------------------|-----------------------------|-------|
| `submitted`           | `submitted`                 | 1:1 |
| `working`             | `working`                   | 1:1 |
| `input-required`      | `input-required`            | 1:1 (Costate adopted A2A's name) |
| `completed`           | `completed`                 | 1:1 |
| `failed`              | `failed`                    | 1:1 |
| `cancelled`           | `canceled`                  | spelling delta — A2A uses single `l`; serializers MUST translate |
| `requires_approval`   | `submitted` (collapsed)     | Costate extension; A2A v1.0 has no equivalent. When emitting to A2A, collapse to `submitted`. |
| `rejected`            | `failed` (collapsed)        | Costate extension; A2A v1.0 has no equivalent. When emitting to A2A, collapse to `failed`. |
| (none — error path)   | `unknown`                   | Costate raises `5xx` rather than entering an indeterminate state. Inbound `unknown` MUST be rejected with `400 INVALID_BODY`. |

Hosts MAY preserve the Costate-specific `requires_approval` /
`rejected` states in metadata when serializing for A2A consumers, so
later round-trips back to a Costate-aware peer recover the precise
semantics. The `status.state` wire field MUST collapse per the table
above.

When Costate and A2A representations of the same task diverge, the Costate
record (§1.4) is the source of truth. A Costate task URI MAY additionally be
exposed as an A2A Agent Card task endpoint; the host SHOULD return the
canonical Costate URI in the A2A response so callers can dereference it via
either protocol.

### 3.4 Activity Operations

#### 3.4.1 Event Types

The following `event_type` values are reserved by this specification:

| Event Type | Emitted When |
|---|---|
| `file.write` | A file is created or updated |
| `file.delete` | A file is deleted |
| `task.create` | A task is created |
| `task.claim` | A task transitions to `working` |
| `task.complete` | A task transitions to `completed` |
| `task.fail` | A task transitions to `failed` |
| `task.cancel` | A task transitions to `cancelled` |
| `task.approve` | A task transitions out of `requires_approval` to `submitted` |
| `task.reject` | A task transitions to `rejected` |
| `task.request_input` | A task transitions `working` → `input-required` (§3.3.10) |
| `task.provide_input` | A task transitions `input-required` → `working` (§3.3.10) |
| `grant.create` | A grant is created |
| `grant.revoke` | A grant is revoked |
| `subscription.create` | A subscription is registered (§6.2) |
| `subscription.failed` | A subscription's delivery has been disabled after retry exhaustion (§6.6) |
| `subscription.revoke` | A subscription is revoked (§6.4) |

Hosts MAY emit additional event types under the prefix `x-<vendor>.*`.
Hosts MUST emit at least the events above for the corresponding state
changes.

#### 3.4.2 `activity.list`

```
GET /v1/workspaces/{workspace_id}/activity?
    target=costate://.../files/notes.md&
    event_type=file.write,file.delete&
    since=2026-05-01T00:00:00.000Z&
    cursor=<token>
```

Response 200:

```json
{
  "events": [
    {
      "event_id": "01KP9...",
      "timestamp": "2026-05-01T14:30:00.000Z",
      "event_type": "file.write",
      "agent": "costate://.../agents/alice",
      "target": "costate://.../files/notes.md",
      "metadata": { "version": "...", "size": 1234 }
    },
    ...
  ],
  "next_cursor": "<opaque>" | null
}
```

Events MUST be returned in chronological order (ascending by `timestamp`).

### 3.5 Scope Model

Costate defines the following scope strings for use in AATs (§1.9) and grants
(§1.7):

| Scope | Permits |
|---|---|
| `files:read` | `file.read`, `file.list` |
| `files:write` | `files:read` + `file.write`, `file.delete` |
| `tasks:read` | `task.get`, `task.list` |
| `tasks:write` | `tasks:read` + `task.create`, `task.claim`, `task.complete`, `task.fail`, `task.cancel`, `task.assign`, `task.request_input`, `task.provide_input` |
| `tasks:admin` | `tasks:write` + `task.approve`, `task.reject` |
| `activity:read` | `activity.list` |
| `grants:admin` | grant management (specified in §4) |

Hosts MUST enforce scope checks before performing the corresponding
operation. Insufficient scope MUST return `403 SCOPE_DENIED` with the
required scope in the error body.

### 3.6 Error Model

All Costate errors are JSON responses with the following shape:

```json
{
  "error": {
    "code": "VERSION_MISMATCH",
    "message": "Expected version 01KP8..., got 01KP9...",
    "details": { ... }       // OPTIONAL, error-code-specific
  }
}
```

The HTTP status code MUST correspond to the standard category:

- `400` for malformed requests, missing required headers
- `401` for missing or invalid authentication
- `403` for valid auth but insufficient scope
- `404` for missing workspaces, files, tasks
- `409` for concurrency conflicts and invalid state transitions
- `429` for rate limiting
- `5xx` for server-side failures

Reserved error codes (REQUIRED to be emitted with the corresponding HTTP
status):

| Code | HTTP | Meaning |
|---|---|---|
| `PRECONDITION_REQUIRED` | 400 | `If-Match` header missing on `file.write`/`file.delete` |
| `INVALID_URI` | 400 | Malformed Costate URI in request |
| `UNAUTHENTICATED` | 401 | Missing or invalid bearer token |
| `SCOPE_DENIED` | 403 | Token lacks required scope |
| `NOT_FOUND` | 404 | Workspace, file, task, or grant does not exist |
| `VERSION_MISMATCH` | 409 | `If-Match` version did not match current |
| `ALREADY_CLAIMED` | 409 | Task claim race lost |
| `INVALID_TRANSITION` | 409 | Attempted illegal task state transition |
| `RATE_LIMITED` | 429 | Per-host rate limit exceeded |

Hosts MAY emit additional vendor-specific codes prefixed with `X_<VENDOR>_`.

### 3.7 Agent Discovery

A Costate host MUST expose a workspace-scoped **agent directory** so that a
sender's client can pick `to_agent` (§3.3.1) when creating a task. This
replaces any need for hosts to implement server-side automated routing
rules: routing decisions belong to the requester's client, not to a
host-side rule engine.

Hosts SHOULD NOT implement automated server-side routing of tasks based on
sender identity, keyword matching, or similar heuristics. Costate is
infrastructure; routing is application logic.

**Endpoint:**

```
GET /v1/workspaces/{workspace_id}/agents
```

**Authorization:** the caller MUST be an authenticated workspace member
(§1.7) or grantee (§1.7) of the workspace. Non-members MUST receive
`403 SCOPE_DENIED` (or `404 NOT_FOUND` per §8.5 cross-tenant info-leakage
prevention).

**Response (200):**

```json
{
  "agents": [
    {
      "agent_uri": "costate://example.com/agents/agent_abc123",
      "agent_id": "agent_abc123",
      "agent_name": "code-reviewer",
      "description": "Reviews PRs for security issues",
      "principal_uri": "costate://example.com/principals/user_alice",
      "principal_email": "alice@example.com"
    }
  ]
}
```

Each entry in `agents` is an agent owned by some workspace member or
grantee. The `principal_email` field MAY be omitted when the host's
privacy policy disallows it.

**Privacy contract:** every workspace member already implicitly knows
the workspace's other members (e.g., when reading the activity log
which carries `actor` URIs per §1.8). The agent directory exposes a
strict superset of that information. v0.1.2 may introduce a per-agent
opt-out (`hidden_in_directory: true`) for sensitive workspaces.

**Filtering:** hosts MAY filter the response — for example, omitting
soft-deleted agents, agents whose principal is currently suspended,
or agents the caller's grant explicitly bars from coordinating with.
Filtering rules are implementation-defined; hosts SHOULD document
any non-obvious filtering they apply.

**Capability advertisement:** hosts that implement this endpoint MUST
advertise the capability `costate.agent-discovery` at §7.1. Hosts that
do not implement it MUST return `501 NOT_IMPLEMENTED` for the endpoint,
and tasks MUST then be created with `to_agent` either pre-known to the
sender or set to `null` / `"*"`.

---

## 4. Authentication and Trust Negotiation

### 4.1 Bearer Tokens

All Costate requests MUST carry an `Authorization: Bearer <token>` header.
A token is one of:

| Token kind                   | Issued by                                               | Authenticates                                                        |
|------------------------------|---------------------------------------------------------|----------------------------------------------------------------------|
| **Agent Access Token (AAT)** | A host, to one of its principals' agents (§1.6)         | An agent acting on behalf of its owning principal                    |
| **Human Session Credential** | A host's identity provider (Cognito, OIDC, custom SSO)  | A principal acting **directly** on a workspace (no agent intermediary) |
| **Guest AAT**                | A host, at §4.7 grant fulfillment                       | A foreign principal's agent under a cross-tenant grant               |

All three are normative auth paths. The host validates the bearer token
on each request and resolves it to a **CallerContext** with the
following shape:

```
CallerContext {
  principal_uri: PrincipalURI    // ALWAYS set
  agent_uri:     AgentURI | null // null when caller is a human session
  scopes:        Scope[]
  workspace_scope: WorkspaceScope
}
```

When `agent_uri` is set, the call is agent-mediated (typical case);
activity events (§1.8) emit `actor = agent_uri`, `on_behalf_of =
principal_uri`. When `agent_uri` is null, the call is human-direct;
activity events emit `actor = principal_uri` only. Operations in §3
treat both modes identically; per-operation scope checks apply
unchanged.

Tokens that fail validation MUST return `401 UNAUTHENTICATED`.

### 4.2 AAT Lifecycle

#### 4.2.1 Issuance

A host issues an AAT only to a verified human principal (verification
mechanism is implementation-defined; SSO with email verification is
RECOMMENDED). The principal designates one of their agents (per §1.6)
as the AAT's owner; the AAT is bound to that agent identity for life.

```
POST /v1/aats
Authorization: Bearer <session credential>
{
  "agent_id": "claude-desktop",
  "scopes": ["files:read", "files:write", "tasks:read", "tasks:write"],
  "workspace_scope": {
    "type": "all" | "selected" | "invited_only",
    "workspace_ids": [ ... ]
  },
  "expires_at": "2027-05-01T00:00:00.000Z"
}
```

Response 201:

```json
{
  "aat_id": "aat_01KP9...",
  "token": "cst_aat_AbC123XyZ...",
  "agent_uri": "costate://api.example.com/me/agents/claude-desktop",
  "scopes": ["files:read", "files:write", "tasks:read", "tasks:write"],
  "workspace_scope": { "type": "all" },
  "created_at": "2026-05-01T14:30:00.000Z",
  "expires_at": "2027-05-01T00:00:00.000Z"
}
```

The token plaintext MUST be returned exactly once. The host MUST store
only a cryptographic hash (SHA-256 RECOMMENDED); the plaintext MUST NOT
be retrievable after issuance.

#### 4.2.2 Revocation

```
DELETE /v1/aats/{aat_id}
```

After revocation, the host MUST reject any subsequent request bearing
the revoked token with `401 UNAUTHENTICATED`. Revocation MUST take
effect within 60 seconds at every host edge.

#### 4.2.3 Rotation

```
POST /v1/aats/{aat_id}/rotate
```

Atomically issues a new token plaintext and revokes the prior one.
Hosts MAY enforce a maximum AAT lifetime; the RECOMMENDED maximum is
365 days.

### 4.3 Workspace Scope

An AAT carries a `workspace_scope` indicating which workspaces it may
access:

| Type | Permitted workspaces |
|---|---|
| `"all"` | Any workspace owned by the principal, plus any workspace where one of the principal's agents holds a grant |
| `"selected"` | Only the workspace IDs explicitly listed |
| `"invited_only"` | No owner workspaces; only workspaces accessed via cross-host grants |

The scope is enforced at workspace-resolution time. An AAT used against
a workspace outside its scope MUST be rejected with `403 SCOPE_DENIED`.

### 4.4 Operation Scopes

In addition to workspace scope, an AAT carries operation scopes per
§3.5. An AAT MAY hold a subset of the scopes its underlying agent
identity could in principle exercise, enabling least-privilege issuance
(e.g., a read-only AAT for an agent that ordinarily has write access).

### 4.5 Cross-Host Grants

A grant (§1.7) is the only mechanism by which an agent on host A may
operate on a workspace on host B. Grants are created on the workspace's
host (the **resource host**) by a principal holding `grants:admin` scope
on the workspace.

```
POST /v1/workspaces/{workspace_id}/grants
Authorization: Bearer <granter AAT>
{
  "grantee_email": "alice@example.com",
  "scopes": ["files:read", "tasks:read", "tasks:write"],
  "expires_at": "2026-08-01T00:00:00.000Z"
}
```

Response 201:

```json
{
  "grant_id": "grant_01KP9...",
  "workspace_uri": "costate://bobs-host.example.com/ws_q4",
  "grantee_email": "alice@example.com",
  "scopes": ["files:read", "tasks:read", "tasks:write"],
  "fulfillment_url": "https://bobs-host.example.com/grants/grant_01KP9.../fulfill",
  "expires_at": "2026-08-01T00:00:00.000Z",
  "fulfilled": false
}
```

The grant exists in the resource host's records. **No token is yet
issued.** A grant in the unfulfilled state denies access; an attempt to
use the grant URI before fulfillment MUST return `401 UNAUTHENTICATED`.

The granter is responsible for delivering the `fulfillment_url` to the
grantee out-of-band (email, A2A message, etc.). Costate does not specify
the delivery channel.

#### 4.5.1 Immediate-Fulfillment Variant (same-host grants)

Hosts MAY return a grant with `fulfilled: true` and omit
`fulfillment_url` when **all** the following hold:

1. The grantee already has a verified principal account at the resource
   host (i.e., they previously authenticated; their `principal_id` is
   known and bound to the `grantee_email`).
2. The grantee's existing AATs (or future ones) inherit access to the
   newly-granted workspace through the host's authorization layer
   without requiring a new guest AAT to be issued.
3. The host operates only as a single-tenant deployment from the
   grantee's perspective (no cross-host trust delegation involved).

This variant — informally "Google Docs–style immediate share" — is
common for Cloud-hosted Costate deployments where workspace owner and
grantee are both principals at the same host. The §4.7 two-step
fulfillment flow remains REQUIRED for cross-host scenarios (where the
grantee's home host differs from the resource host) because that case
genuinely needs a separately-issued guest AAT.

A host that only supports immediate-fulfillment for some grants and
two-step for others MUST return the appropriate response shape per
grant. Clients MUST handle both: when `fulfilled: true` and no
`fulfillment_url`, the grantee can use their existing AAT against the
workspace immediately; when `fulfilled: false` with a
`fulfillment_url`, the grantee MUST visit it and obtain a guest AAT
per §4.7 before operating on the workspace.

### 4.6 Grant Identifier Forms

Costate v0.1 defines `grantee_email` as the REQUIRED grantee identifier
form. Hosts MAY support additional forms (e.g., `grantee_did`,
`grantee_oidc_sub`) under host-specific extensions; the email form
MUST be supported by all conforming hosts as the lowest-common-denominator.

Open question: see Appendix C, item 8.

### 4.7 Grant Fulfillment

When the grantee visits the `fulfillment_url`, they MUST:

1. Authenticate to the resource host as the email address named in the
   grant. Authentication mechanism is implementation-defined (SSO,
   magic link, OIDC).
2. Designate which of *their* agents will exercise the grant (e.g.,
   their `claude-desktop` agent on `alices-host.example.com`).
3. Receive a **guest AAT** bound to that agent identity and scoped to
   the grant's permissions:

```json
{
  "guest_aat_id": "g_aat_01KP9...",
  "token": "cst_aat_XyZ789QrS...",
  "grantor_workspace_uri": "costate://bobs-host.example.com/ws_q4",
  "grantee_agent_uri": "costate://alices-host.example.com/personal/agents/claude-desktop",
  "scopes": ["files:read", "tasks:read", "tasks:write"],
  "expires_at": "2026-08-01T00:00:00.000Z"
}
```

The token plaintext is delivered exactly once. Subsequent Costate requests
from Alice's `claude-desktop` agent to `bobs-host.example.com` MUST
present this token. The token is a regular `cst_aat_` AAT
(distinguishable from a local AAT only by the resolved agent URI
pointing to a foreign host); validation logic on the resource host is
identical to §4.2.

The grant record MUST be updated to `fulfilled: true` with the bound
`grantee_agent_uri` recorded.

### 4.8 Grant Revocation

The resource host MAY revoke a grant at any time:

```
DELETE /v1/workspaces/{workspace_id}/grants/{grant_id}
Authorization: Bearer <granter AAT or admin AAT>
```

Revocation atomically:

1. Marks the grant as revoked.
2. Invalidates the associated guest AAT (if fulfilled).
3. Cancels in-flight tasks where `recipient_user_id` corresponded to
   the grantee's principal (transitions to `cancelled` per §3.3.5).
4. Emits a `grant.revoke` activity event into the workspace.

The resource host SHOULD NOT push revocation notifications to the
grantee's host out-of-band. Revocation is enforced at request time:
the next call from the grantee bearing the now-invalidated guest AAT
fails with `401 UNAUTHENTICATED`. Eventual consistency is acceptable
within the 60-second window of §4.2.2.

### 4.9 Cross-Host Trust (TLS)

When an agent on host A first contacts host B (e.g., to fulfill a
grant or to call a Costate operation under a guest AAT), the calling
client:

- MUST verify host B's TLS certificate against system trust roots
  (RFC 5280).
- SHOULD pin the host B certificate fingerprint after first successful
  use (Trust-on-First-Use, TOFU).
- SHOULD warn the user, or refuse the connection by default, if the
  pinned fingerprint changes; users MAY explicitly approve a new
  fingerprint.
- MAY consult a host-discovery registry (e.g., AAIF-published list of
  Costate hosts) for additional reputation signals; Costate v0.1 does not
  specify such a registry.

Hosts MUST present TLS certificates valid for the DNS name in their
URI. Costate hosts MUST NOT serve production traffic over plaintext HTTP
(reiterating §1.1).

### 4.10 Relationship to A2A Authentication

A2A v1.0 specifies bearer-token authentication for direct agent-to-agent
calls. Costate's authentication model is **independent of A2A**: a Costate host
validates AATs against its own issuance records, not against A2A
bearer tokens.

When a Costate host emits a subscription event over A2A push (§6.3.1), the
A2A push transport MAY carry an A2A-issued bearer token authenticating
the Costate host to the receiving A2A endpoint. This A2A token is used
solely for A2A-layer authentication of the push delivery; it is not a
Costate AAT, and the A2A endpoint MUST NOT treat it as one.

A host that operates as both a Costate host AND an A2A endpoint MAY share
token infrastructure internally, but MUST NOT permit an A2A token to
authenticate a Costate request, nor an AAT to authenticate an A2A request.
The two protocol layers maintain independent authentication boundaries.

### 4.11 Human Session Credentials

Per §4.1 the third bearer-token kind is the **Human Session Credential**
— the auth path a principal uses to act *directly* on a workspace,
without an agent intermediary. Typical instantiations:

- A short-lived signed JWT issued by the host's identity provider
  (Cognito, Auth0, Okta, custom OIDC) after SSO sign-in.
- A first-party browser session cookie scoped to the host's UI origin.
- A device-bound passkey assertion, where the underlying transport
  presents a derived bearer.

The credential format is **implementation-defined**. What is normative:

1. The host MUST validate the credential against its identity provider
   (or equivalent local issuance log) on every request.
2. The host MUST resolve the credential to a `principal_uri` (per §1.5).
3. The host MUST construct a CallerContext (per §4.1) with
   `agent_uri: null` and the resolved `principal_uri`.
4. Failures MUST return `401 UNAUTHENTICATED` with the same shape as
   AAT validation failures (§3.6).

**Operations a principal can perform directly:** Any operation an agent
can perform under §3, subject to the principal's scopes. There is no
operation that is "agent-only" or "human-only" at the protocol layer.
Principals typically perform a *narrower* range in practice — most
file/task work flows through agents — but HITL operations like
`task.approve` and `task.reject` are canonical human-direct cases
because they require deliberate human judgment by spec.

**Activity emission for human-direct calls** (per §1.8):

```json
{
  "event_id": "01KP9...",
  "event_type": "task.approve",
  "actor":      "costate://api.example.com/principals/u_abc123",
  "target":     "costate://api.example.com/ws_q4/tasks/01KP9...",
  "metadata":   { "comment": "approved per Q4 review" }
}
```

`on_behalf_of` is absent because the actor IS the principal. Audit
consumers reading the event do not need to dereference further to
attribute the action to a human.

**Capability advertisement.** Hosts that support human-session
credentials SHOULD advertise the `costate.human-session` capability via
§7.1 capability discovery. Conformance suites (Appendix B) skip the
direct-principal tests against hosts that do not advertise this
capability.

## 5. Compliance Behaviors

### 5.1 Audit Retention

A Costate host MUST retain activity events (§3.4) for a minimum of 90 days
after creation. Hosts targeting EU AI Act Article 12 records-keeping
SHOULD retain events for at least 6 years.

Activity events MUST NOT be deleted before their retention window
expires, except in response to:

- Workspace deletion (cascades to all events scoped to the workspace).
- A GDPR Article 17 erasure request (§5.3).
- Explicit retention-policy change communicated via a `retention.policy_change`
  activity event (§5.4).

Hosts MUST expose their retention policy via workspace metadata field
`compliance.activity_retention_days` (integer, days). Clients MAY use
this to project audit guarantees before writing sensitive data into a
workspace.

### 5.2 Tamper-Evident Activity Log

Hosts advertising compliance with audit-evidence requirements MUST
implement hash chaining over the activity event sequence within each
workspace.

Hash chain semantics:

- Each event carries a `prev_hash` field referencing the SHA-256 hex
  digest of the canonical encoding of the prior event in the workspace,
  ordered by `event_id` ascending.
- The first event in a workspace has `prev_hash` = `""` (empty string).
- The canonical encoding of an event for hashing purposes is its UTF-8
  JSON serialization with object keys in lexicographic order, no
  whitespace, and the `prev_hash` field excluded from the hashed input.

Verification: a consumer can recompute hashes over the canonical
encoding and compare to declared `prev_hash` values. Any mismatch
indicates tampering, ordering corruption, or implementation bug — all
MUST be surfaced as a verification failure.

Hosts that do not advertise tamper-evidence MAY omit `prev_hash`;
absence of the field signals no integrity guarantee.

### 5.3 GDPR Article 17 (Right to Erasure)

The right to erasure under GDPR Article 17 conflicts with the
immutability requirement of audit logs (§1.8, §5.1). Costate resolves this
via **tombstoning**:

1. An erasure request received by the host MUST replace personal-data
   fields in affected events with a structured marker:

   ```json
   {
     "_erased": true,
     "erased_at": "2026-05-01T14:30:00.000Z",
     "reason": "GDPR Art 17 request <ref>"
   }
   ```

2. Event metadata required for audit chain integrity (`event_id`,
   `timestamp`, `event_type`, `prev_hash` if present) MUST be
   preserved.

3. The erasure operation itself MUST emit a new event of type
   `audit.erasure` referencing the affected events. The
   `audit.erasure` event MUST NOT contain personal data; it carries
   only the erased event IDs and an opaque request reference.

4. File contents MAY be erased by replacing the stored bytes with a
   tombstone marker; the file's `version` history MUST reflect the
   erasure with a tombstone version distinct from any normal write.

Tombstoning satisfies GDPR Article 17 (personal data is no longer
accessible) while preserving the integrity of the audit chain required
by EU AI Act Article 12. Hosts SHOULD document their erasure SLAs;
GDPR's "without undue delay" obligation typically caps at 30 days.

### 5.4 EU AI Act Traceability (Articles 12, 13)

EU AI Act Article 12 requires automated logging of high-risk AI system
operations; Article 13 requires transparency of system decisions to
affected persons. Costate supports both via the activity event model:

- **Article 12 (records-keeping):** activity events of types `task.*`,
  `file.write`, `file.delete`, `grant.*`, `subscription.*` constitute
  the operations log. Hash chaining (§5.2) provides tamper-evidence.
  Retention SHOULD be at least 6 years.
- **Article 13 (transparency to affected persons):** the
  `activity.list` query (§3.4.2) permits authorized consumers,
  including data subjects exercising their right to access, to
  retrieve the decision trail. Hosts MUST support filtering events
  by an `affected_subject` field (when present in metadata) so a
  subject can retrieve only their own trail.

A host advertising EU AI Act compliance MUST implement §5.2 hash
chaining and §5.3 erasure tombstoning, and MUST retain events for at
least 6 years.

### 5.5 Compliance Profiles

Hosts advertise their compliance level via a workspace-level metadata
field `compliance.profile` (array of profile names):

| Profile | Includes |
|---|---|
| `"basic"` | §5.1 retention only |
| `"audit-evidence"` | `"basic"` + §5.2 hash chain |
| `"gdpr"` | `"basic"` + §5.3 erasure |
| `"eu-ai-act"` | `"audit-evidence"` + `"gdpr"` + §5.4 (full) |
| `"hipaa"` | reserved for v0.1.2 |
| `"sox"` | reserved for v0.1.2 |

Profiles are additive. A workspace MAY advertise multiple. Conformance
to a profile MUST be implemented in full; partial implementation MUST
NOT advertise the profile.

A workspace's compliance profile MAY change over time, but MUST NOT
weaken: once a workspace advertises `"eu-ai-act"`, subsequent profile
arrays MUST continue to include `"eu-ai-act"` (or a successor profile
that subsumes it). A weakening profile change MUST be rejected with
`409 INVALID_TRANSITION`.

## 6. Subscription and Notification

### 6.1 Subscription Events

A Costate host MUST emit a **subscription event** upon every state change in
a workspace. Subscription events are the protocol's mechanism for
notifying agents of changes without requiring polling.

A subscription event has the same fields as an activity event (§3.4.2)
plus a `workspace_uri` field identifying the source workspace for the
convenience of cross-host subscribers:

```json
{
  "event_id": "01KP9...",
  "workspace_uri": "costate://api.example.com/ws_q4",
  "timestamp": "2026-05-01T14:30:00.000Z",
  "event_type": "file.write",
  "agent": "costate://api.example.com/ws_q4/agents/alice",
  "target": "costate://api.example.com/ws_q4/files/notes.md",
  "metadata": { "version": "01KP9...", "size": 1234 }
}
```

The `event_type` enumeration mirrors §3.4.1. The event schema is
**normative** regardless of how the event is delivered.

### 6.2 Subscriber Registration

```
POST /v1/workspaces/{workspace_id}/subscriptions
{
  "delivery": {
    "type": "a2a-push",
    "endpoint": "https://bobs-host.example.com/a2a/notifications"
  },
  "filters": {
    "event_types": ["task.create", "task.claim", "task.complete"],
    "target_prefix": "costate://api.example.com/ws_q4/tasks/"
  }
}
```

Response 201:

```json
{
  "subscription_id": "sub_01KP9...",
  "uri": "costate://api.example.com/ws_q4/subscriptions/sub_01KP9..."
}
```

The subscriber MUST present an AAT (§1.9) with `activity:read` scope or
a grant-issued token of equivalent scope on the target workspace.

### 6.3 Delivery Transports

Costate defines exactly two delivery transport types:

| `delivery.type` | Scope | Specification Status |
|---|---|---|
| `a2a-push` | Cross-host delivery to a foreign Costate host | NORMATIVE for hosts that advertise federation; OPTIONAL for single-tenant hosts (see §6.3.1) |
| `host-local` | Same-host delivery to a local subscriber | implementation-defined |

#### 6.3.1 `a2a-push` (Normative for federated hosts)

When `delivery.type` is `a2a-push`, the Costate host MUST deliver
subscription events as **A2A v1.0 push messages** to the registered
endpoint. The A2A message body MUST contain the Costate subscription event
(per §6.1) serialized as JSON in the message's `data` part. The
receiving agent dereferences the `target` URI back into the originating
Costate host to read the canonical resource state.

Costate hosts MUST NOT include resource bodies in subscription events — only
event metadata and URI references. Rationale: this preserves authorization
boundaries; the receiver re-authenticates against the Costate host using its
grant or AAT before reading the referenced resource.

Cross-host subscriber registration requires a valid grant (§1.7) on the
target workspace. Without a grant, the host MUST reject the subscription
with `403 SCOPE_DENIED`.

A2A is the **single canonical cross-host transport**. Costate does not define
its own subscription wire protocol; it composes with A2A.

**Optional for single-tenant hosts.** Hosts that operate as single-tenant
deployments (no cross-host federation; all subscribers are
same-host principals) MAY return `501 NOT_IMPLEMENTED` for subscriptions
that request `delivery.type = a2a-push`. Such hosts remain conformant
provided they:

1. Continue to support `host-local` delivery (§6.3.2) for local
   subscribers.
2. Document the limitation in their `/v1/capabilities` response by
   advertising `costate.subscription` (acceptable: the host implements
   §6.2 and §6.3.2) but NOT advertising any cross-host federation
   capability.
3. Return `501 NOT_IMPLEMENTED` with a clear error message rather than
   accepting an `a2a-push` subscription that would silently fail to
   deliver.

This carve-out parallels §4.5.1 immediate-fulfillment: the spec
recognizes that not every Costate-conformant host needs to support
cross-host federation, but those that do MUST implement the full A2A
push transport. Hosts that later add federation (e.g., as part of
joining an AAIF-coordinated host network) MUST add `a2a-push` to be
considered fully federated-conformant.

#### 6.3.2 `host-local` (Implementation-Defined)

For same-host delivery (subscriber's principal is local to the host, or
holds a grant whose grantee is local), the host MAY support any
transport: SSE streams, WebSocket, message queues, polling endpoints, or
A2A push to a local A2A endpoint. The event schema (§6.1) MUST be
preserved regardless of transport.

Hosts SHOULD document their host-local transports for SDK implementers,
but client portability across hosts is not guaranteed for `host-local`
delivery. Clients requiring portability MUST use `a2a-push`.

### 6.4 Subscription Management

```
GET    /v1/workspaces/{workspace_id}/subscriptions       (list)
DELETE /v1/workspaces/{workspace_id}/subscriptions/{id}  (revoke)
```

Subscriptions MAY have an OPTIONAL `expires_at` timestamp. After expiry,
the host MUST stop delivering events and MAY garbage-collect the
subscription record.

### 6.5 Delivery Semantics

Costate guarantees **at-least-once** delivery per subscription. Subscribers
MUST tolerate duplicate events; deduplication is performed using
`event_id`.

Events for a given workspace MUST be delivered in `event_id` order
(equivalent to timestamp order for ULID-encoded IDs). Hosts MAY batch
deliveries within a single A2A push message provided ordering is
preserved within the batch. There is no ordering guarantee across
workspaces.

### 6.6 Failure Handling

If `a2a-push` delivery fails, the host MUST retry with exponential
backoff for at least 24 hours. After retry exhaustion, the host MUST
emit a `subscription.failed` activity event into the source workspace
and disable the subscription. Re-enabling requires explicit subscriber
action via §6.4.

---

## 7. Other Optional Capabilities

Costate defines a base profile (§§1–4, 6) that all conforming hosts MUST
support. The capabilities enumerated in this section are OPTIONAL
extensions. Each is given a stable feature name; full normative
specifications for each capability live in companion RFCs.

### 7.1 Capability Discovery

A host MUST expose its supported capabilities at a well-known endpoint:

```
GET /v1/capabilities
```

Response 200:

```json
{
  "version": "0.1.1-draft",
  "capabilities": [
    "costate.core",
    "costate.subscription",
    "costate.compliance.eu-ai-act",
    "costate.sql",
    "costate.schema-registry",
    "costate.snapshots",
    "x-acme.custom-feature"
  ]
}
```

The `version` field identifies the Costate base specification version the
host conforms to. Capability strings use dot-namespaced lowercase ASCII.
The prefix `costate.*` is reserved for this specification family. Vendor
extensions MUST use the prefix `x-<vendor>.*`.

A host MUST advertise at least `costate.core` and `costate.subscription` to be
considered conformant. All other capabilities are optional.

### 7.2 SQL Workspace Extension (`costate.sql`)

*Companion spec: forthcoming as Costate-RFC-v0.1.SQL.*

A workspace MAY contain a SQLite-compatible relational database
alongside its file tree. Operations: `sql.read`, `sql.write`, `sql.ddl`
with corresponding scopes `sql:read`, `sql:write`, `sql:ddl`. Use case:
agents share queryable structured state, not just filesystem blobs.

Hosts advertising `costate.sql` MUST support full-text search (FTS5 or
equivalent) and MUST emit `sql.write` and `sql.ddl` events into the
activity log per §3.4.1.

### 7.3 Schema/Contract Registry (`costate.schema-registry`)

*Companion spec: forthcoming.*

A workspace MAY publish typed schema contracts (JSON Schema, Avro,
Protobuf) that agents reference when reading/writing structured files
or task payloads. Contracts enable type-safe agent-to-agent data
exchange and runtime validation at workspace boundaries.

### 7.4 Sparse Versioning / Snapshots (`costate.snapshots`)

*Companion spec: forthcoming.*

A workspace MAY support point-in-time snapshots of its file collection,
permitting time-travel reads. Operations: `snapshot.create`,
`snapshot.read`, `snapshot.list`. Snapshot semantics for cross-tenant
grants (whether grantees can read snapshots predating their grant) is
specified in the companion RFC.

### 7.5 Large-File Streaming (`costate.streaming`)

*Companion spec: forthcoming.*

A workspace MAY support chunked upload and resumable download for files
exceeding the base profile's 16 MiB recommendation. Operations:
`file.upload-init`, `file.upload-chunk`, `file.upload-complete`,
`file.download-range`.

### 7.6 Vendor Extensions

Hosts MAY define custom capabilities under the `x-<vendor>.*` namespace
(e.g., `x-acme.custom-feature`). Vendor extensions:

- MUST NOT shadow standard `costate.*` capability names.
- MUST be documented at a host-published URL referenced from
  `/v1/capabilities` via an OPTIONAL `documentation_url` field per
  capability.
- MUST NOT alter the semantics of standard operations; they may only
  add new operations.

Cross-host interoperability is not guaranteed for vendor extensions.
Clients SHOULD treat unknown capabilities as opaque and SHOULD NOT
fail when encountering them.

## 8. Security Considerations

### 8.1 Threat Model

Costate's threat model assumes:

**Untrusted parties:**

- Network attackers (mitigated by TLS per §4.9 / §1.1).
- Other tenants on a multi-tenant host (mitigated by workspace scope
  and grant enforcement, §4.3, §4.5).
- Compromised agents whose AATs leaked (mitigated by revocation per
  §4.2.2; lazy enforcement window per §4.8).

**Partially trusted parties:**

- Cross-host grantees: limited to scopes and workspace per grant; can
  be revoked at any time. The grantor accepts that the grantee's host
  has visibility into the grantee's actions on the workspace.

**Trusted parties:**

- The workspace's resource host has full visibility into workspace
  contents. Clients trust this entity by choosing to put data there;
  Costate cannot remove this trust without changing storage architecture
  (e.g., end-to-end encryption is out of scope for v0.1).

**Out of scope:**

- Adversarial agents within the same workspace with valid scope: a
  write-scoped agent can write malicious content; Costate does not
  validate semantic content (see §8.3).
- Side-channel attacks on host implementations.
- Denial-of-service by trusted parties (rate limits per §8.4 mitigate
  but cannot prevent).
- Compromise of reference-implementation supply chain (see §8.6).

### 8.2 Replay Protection

Costate relies on TLS for transport-level replay protection (RFC 8446).
At the application layer:

- Read-only requests (`file.read`, `file.list`, `task.get`,
  `task.list`, `activity.list`) are idempotent; replay is harmless.
- `file.write` and `file.delete` are guarded by `If-Match` (§3.2.2,
  §3.2.3): replay of an old write fails because version no longer
  matches.
- `task.claim` is idempotent at the protocol level: a second claim
  attempt by the same agent succeeds and returns the same claimed
  state; a different agent attempting after the claim receives
  `409 ALREADY_CLAIMED`.
- `task.complete`, `task.fail`, `task.cancel`, `task.approve`,
  `task.reject` are guarded by terminal-state semantics (§3.3.1):
  replay of a terminal transition fails with `409 INVALID_TRANSITION`.

Hosts MAY additionally enforce per-AAT request nonces or timestamp
windows; these are implementation-defined.

### 8.3 Prompt Injection at the Protocol Layer

Costate **does not** scan workspace content for prompt-injection attempts.
Files, task descriptions, and grant metadata may contain
attacker-controlled text that is later read by an agent. This is a
deliberate design decision:

- Content scanning is an application-layer concern that varies by use
  case, language, and threat model.
- The protocol cannot reasonably validate semantic safety without
  imposing a particular content schema.
- Cross-tenant collaboration (the protocol's purpose) inherently
  requires accepting content from other parties; the protocol enables
  this safely-as-possible by isolating per-workspace and per-grant.

Hosts MAY layer content scanning above Costate. Such scanning MUST NOT
mutate or selectively hide events from authorized consumers; events are
immutable per §1.8.

Implementers and integrators are responsible for hardening agents
against prompt injection from workspace contents. This is a known
shared-substrate risk that Costate exposes by design.

### 8.4 Denial-of-Service Mitigations

A Costate host MUST enforce rate limits at the granularity of:

- **Per-AAT request rate.** Default 1000 req/min RECOMMENDED;
  implementations MAY tune.
- **Per-workspace mutation rate.** Protects shared workspaces from a
  single agent flooding writes.
- **Subscription delivery rate.** Caps `a2a-push` outbound per
  subscription per second.

Rate limits exceeded MUST return `429 RATE_LIMITED` per §3.6, with a
`Retry-After` header per RFC 9110.

Hosts MUST enforce maximum payload sizes:

| Resource | Limit |
|---|---|
| File body | minimum supported 16 MiB; maximum implementation-defined |
| Task description | 8192 octets per §1.4 |
| Activity event metadata | 4096 octets RECOMMENDED |
| Grant scope list | 64 scopes RECOMMENDED |

Subscription delivery failures (§6.6) MUST use exponential backoff;
tight retry loops are PROHIBITED.

### 8.5 Cross-Tenant Information Leakage

The cross-tenant grant model (§1.7, §4.5) creates information-leakage
surfaces. The host MUST enforce server-side filtering on every
read-side operation visible to grantees:

- **Activity events:** a grantee with `files:read` on file X MUST see
  only events whose `target` is X (or a subset of X). They MUST NOT
  see events for other files, even if they share the same workspace.
- **Task lists:** grantees see tasks where they are creator, recipient,
  or eligible claimant; they MUST NOT enumerate other tasks.
- **Grant lists:** grantees see only their own grant on the workspace;
  they MUST NOT enumerate other grants.
- **File listings:** grantees see only files within their granted
  scope.

Client-side filtering is NOT sufficient. Hosts MUST enforce these
filters at the data layer.

### 8.6 Supply Chain

Reference implementations of Costate are not part of this specification.
However, integrators selecting a Costate host SHOULD verify:

- The implementation passes the conformance test suite (Appendix B).
- Source code (where open) is available for audit.
- Cryptographic operations (token hashing per §4.2.1, hash chaining
  per §5.2) use vetted primitives (SHA-256 minimum; SHA-512 or BLAKE2
  acceptable).
- Build-time dependency integrity is verified (lockfiles + hashes).
- Token entropy meets minimum requirements (§1.9: 32 octets of
  randomness from a CSPRNG).

A Costate host MAY publish a Software Bill of Materials (SBOM) and
build-attestation artifacts (e.g., SLSA Level 3+) at a well-known URL.
v0.1 does not standardize the location; future versions may.

### 8.7 AAT Storage and Disclosure

AAT plaintext is delivered to clients exactly once at issuance (§4.2.1)
and MUST be transmitted only over TLS. Clients SHOULD store AATs in
operating-system credential stores (Keychain, secret service,
Windows Credential Manager) rather than plaintext config files when
the storage substrate permits.

Hosts MUST NOT log AAT plaintext. Token-hash logging is acceptable
provided the hash is computed with a one-way function over the full
token (not a prefix), so log access does not enable reconstruction.

A leaked AAT plaintext is a compromise. The host's revocation API
(§4.2.2) is the recovery mechanism; hosts SHOULD support proactive
revocation triggered by anomaly detection (out-of-scope behaviors for
the agent's profile, geographically improbable usage, etc.).

---

## Appendix A: MCP Tool Bindings (informational)

A Costate host MAY expose operations as MCP tools for convenience. The
following bindings are RECOMMENDED:

| MCP Tool Name | Costate Operation |
|---|---|
| `costate_read` | `file.read` (§3.2.1) |
| `costate_write` | `file.write` (§3.2.2) |
| `costate_delete` | `file.delete` (§3.2.3) |
| `costate_list` | `file.list` (§3.2.4) |
| `costate_task` | `task.*` (§3.3) — action determined by `action` parameter |
| `costate_log` | `activity.list` (§3.4.2) |

These bindings are **informational**. The HTTP form (§3) is normative.

## Appendix B: Conformance Test Suite

A conformance test suite MUST be maintained alongside this specification
at `costate/packages/conformance/` (path subject to revision). An
implementation is conformant if it passes all REQUIRED tests in the suite
matching this specification version.

## Appendix C: Open Questions for v0.1 Review

The following questions are explicitly open for review prior to v0.1
freeze:

1. Should `task.payload_ref` and `task.result_ref` permit non-Costate URIs
   (e.g., `https://`)? Pros: composability with external systems. Cons:
   weakens the protocol's content-addressing story.
2. Should `version` tokens be required to be content-addressable
   (e.g., SHA-256), or is opaque sufficient? The reference implementation
   uses SHA-256 today.
3. Should grants be issuable to arbitrary identifiers (e.g., DID, OIDC
   subject) rather than only email addresses?
4. Should activity events carry a hash chain (linked-list integrity
   commitment) as REQUIRED or as a §5 capability?
5. What is the minimum subset of operations a host MUST implement to
   advertise Costate conformance? Files-only, files+tasks, or all of §§3.2–3.4?
6. Should the resource host *push* grant revocations to the grantee's
   host (proactive), or rely only on next-call lazy enforcement
   (current §4.8)? Lazy is simpler; push reduces the window where a
   revoked grantee can read fresh resources.
7. Should TLS certificate pinning (§4.9) be MUST or SHOULD on
   fingerprint-change refusal? MUST is more secure but breaks
   legitimate certificate rotation flows.
8. Should `grantee_email` remain the lowest-common-denominator grantee
   form forever, or should v1.0 require DID/OIDC support?
9. Should guest AAT plaintext be retrievable post-fulfillment by the
   grantee on their host (e.g., for re-display in their UI), or
   delivered exactly once like local AATs? Once-only is more secure;
   re-displayable is more user-friendly across device migrations.
10. Should A2A push delivery (§6.3.1) require the receiving A2A
    endpoint to authenticate the Costate host? If yes, via what mechanism
    (mTLS, signed-events, A2A-issued bearer)?

Comments on this draft should be filed at the protocol working repository
(location TBD) or directed to the editors listed above.

---

**End of Costate v0.1.1-draft. Sections 1–8 drafted normatively.
Companion RFCs forthcoming for §7 capability specifications
(SQL, Schema Registry, Snapshots, Streaming).**
