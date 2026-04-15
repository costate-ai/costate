# RFP Assembly

> Friday 5pm. 40-page RFP due Monday noon. Sales, finance, and outside counsel
> in parallel. No one overwriting anyone else.

## The scenario

A potential customer sent a 40-page RFP. You need:
- A sales agent drafting the narrative (capability statement, case studies, timeline)
- A finance agent filling in pricing, T&Cs, and cost tables
- **Your outside law firm's** agent reviewing indemnity, IP, liability clauses

Everyone works in parallel. Everyone writes to the same document. A human has
to approve the final assembly before it goes out.

Costate is the shared workspace (versioned writes), the coordination bus (task
handoffs), and the cross-tenant fabric (legal's agent lives in a different
tenant but reads and writes here). The whole thing is auditable — every
proposal revision appears in the activity log.

## Agents

| Handle | Tenant | Role | Role scope |
|:-------|:-------|:-----|:-----------|
| `@sales/drafter` | yours | Writes narrative sections. Claims tasks from `@sales/lead` queue. | `write` |
| `@finance/pricer` | yours | Fills pricing tables and commercial T&Cs. | `write` |
| `@external/legal` | **their tenant** — cross-tenant grant | Reviews clauses, redlines, comments via a dedicated markdown file. | `read` + `write` on legal-review.md |

## The coordination moment — two of them

**1. Cross-tenant grant.** Your law firm uses their own Costate account. You
share this workspace with their agent:

```json
{ "tool": "costate_access",
  "params": {
    "operation": "grant",
    "workspace_id": "ws_xxxxxxxxxxxxxxxx",
    "invitee": { "user_id": "<law-firm-cognito-sub>", "agent_id": "<their-agent-ulid>" },
    "role": "write"
  }
}
```

No invite/accept. Their agent is live immediately. They redline `legal-review.md`;
your agents see it via SSE. Revoke access when the deal closes:

```json
{ "tool": "costate_access", "params": { "operation": "revoke", "grantee": {...} } }
```

**2. HITL approval gate.** When drafts are ready, the lead creates a handoff
with `needs_approval=true`:

```json
{ "tool": "costate_handoff",
  "params": {
    "action": "create",
    "task": "Assemble final.pdf — legal has signed off, numbers are locked. Approve for send.",
    "needs_approval": true,
    "approval_deadline": 1776300000
  }
}
```

Nothing can claim the task until a human clicks **Approve** in the Control
Tower. Belt and suspenders for "did anyone actually read this before it went
to the CEO?"

## What's in the box

- `rfp-inbound.pdf.placeholder` — drop the real RFP here before init (or
  upload via `costate_write` after). A placeholder marker to remind you.
- `company-context.md` — boilerplate facts about your company that every
  section draws from (founding date, HQ, certifications, case studies).
- `legal-review.md` — skeleton with every clause the law firm should review.
- `drafts/` — agents write section drafts here before assembly.
- `AGENTS.md` — roster + handoff conventions.

## Next steps

1. Drop the real RFP PDF into the directory, then from your terminal:
   ```bash
   costate upload rfp-inbound.pdf
   ```
   This uses Microsoft's `markitdown` to convert the PDF to Markdown and
   writes it to your workspace as `rfp-inbound.md`. One-time setup:
   `pipx install 'markitdown[all]'`.
   Then ask your lead agent: "Write `company-context.md`, `legal-review.md`,
   and `AGENTS.md` into the workspace via `costate_write`."
2. Mint a second PAT for `@finance/pricer` (`costate token create`).
3. Grant access to your law firm's agent — they provide their `(user_id,
   agent_id)` pair out of band (email). Ask them to stage a PAT for their
   agent with your workspace in scope.
4. Kick off the draft: "Read the RFP. Create a task per section. Route
   technical-capability sections to `@sales/drafter`, pricing to
   `@finance/pricer`, clauses to `@external/legal`."
5. Watch the activity feed in the Control Tower. When all sections marked
   complete, request the assembly task with HITL gate.

## Why this wouldn't work without Costate

Sharing a Google Doc means three people editing the same file with no
coordination — versioning is per-save, merges are manual. Passing context via
prompts means the legal agent never sees what sales wrote. Email attachments
are worse.

What Costate buys you:
- **OCC** — if two agents save the same section simultaneously, one sees a
  `CONCURRENCY_VERSION_CONFLICT` and must re-read. No silent overwrites.
- **Cross-tenant grants** — your law firm's agent has access without joining
  your company's identity provider.
- **HITL gate** — legal final-sign-off is a first-class state, not a Slack
  message someone forgets to send.
- **Activity log** — every change traceable. Six months later when the deal
  closes and auditors ask "who wrote the indemnity clause," the log has the
  answer.
