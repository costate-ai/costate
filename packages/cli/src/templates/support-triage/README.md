# Support Triage

> 500 weekend tickets. Three specialized agents. Zero double-replies.

## The scenario

You run customer support. Monday morning the queue is a pile of unread tickets
covering billing, product, and technical issues. You want three specialized
agents picking work off the queue in parallel, each applying their own policy
playbook, without ever accidentally replying to the same ticket twice.

Costate is the shared state AND the coordination layer. Agents read tickets from
the SQLite table, atomically claim one via `costate_handoff`, respond, and mark
it done. The claim uses compare-and-swap — if two agents reach for the same
ticket, exactly one wins.

## Agents

| Handle | Role | Reads | Writes |
|:-------|:-----|:------|:-------|
| `@cs/triage` | Classifier. Reads the inbox, assigns a category, creates a handoff task targeting the right specialist. | `tickets.sqlite` | `tickets.sqlite`, `costate_handoff` |
| `@cs/billing` | Billing specialist. Applies `policies/refunds.md`. | `policies/refunds.md`, `tickets.sqlite` | `tickets.sqlite`, `costate_handoff complete` |
| `@cs/tech` | Tech specialist. Applies `policies/tech.md`. | `policies/tech.md`, `tickets.sqlite` | `tickets.sqlite`, `costate_handoff complete` |

## The coordination moment

Two agents both see ticket `T-4823` in the queue. Both call:

```json
{ "tool": "costate_handoff",
  "params": { "action": "claim", "task_id": "task_abc123" } }
```

Costate's atomic CAS guarantees exactly one succeeds; the loser gets
`TASK_CONFLICT` and moves on to the next unclaimed ticket. No double-reply,
no lock file, no careful polling logic.

When a specialist finishes, they `complete` the task and update
`tickets.sqlite` with the response. Triage sees the state change via SSE and
knows the workflow advanced.

## What's in the box

- `schema.sql` — DDL for the `tickets` table (id, subject, body, category, status, response, assigned_agent)
- `policies/refunds.md` — refund policy checklist for `@cs/billing`
- `policies/tech.md` — triage-to-escalation playbook for `@cs/tech`
- `AGENTS.md` — declarative agent roster your agents read on first connect

## Next steps

1. Paste the MCP config snippet (printed by `costate init`) into your Claude
   Desktop / Cursor / Claude Code config. Restart the MCP client.
2. In your first chat: "Read `schema.sql` and run it against the workspace.
   Then upload every file in `policies/` to the workspace at the same path."
3. For each agent persona, create a separate PAT:
   `costate token create` → paste into another Claude Desktop profile →
   connect as that agent.
4. Ask your triage agent: "Watch for new rows in `tickets` where
   `status='new'`. Classify each and create a handoff task targeting the
   right specialist."
5. Drop a real backlog of tickets (CSV import or direct SQL INSERT) and watch
   the system drain the queue in real time.

## Why this wouldn't work without Costate

A single Claude session can absolutely read one ticket and reply. But the
*parallelism* here is load-bearing. Without atomic claims, two concurrent
triage agents both pick ticket T-4823 and the customer gets two contradictory
replies. Without shared SQLite + SSE, specialists can't observe state changes
or see what triage already classified. Without cross-agent handoff with CAS,
"who's handling this" is a distributed-systems problem you have to solve
yourself.
