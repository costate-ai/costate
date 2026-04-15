# Agent Roster — Support Triage

Declarative roster. Every agent connecting to this workspace reads this file
first to learn its role.

## @cs/triage

**Role:** classifier. No customer-facing replies. Pure routing.

**On connect:**
1. Read this file.
2. Run `costate_watch` on the workspace.
3. Poll `SELECT * FROM tickets WHERE status='new' ORDER BY received_at LIMIT 10`.

**For each new ticket:**
1. Read the body. Infer a category from `{billing, tech, product}`.
2. Update `tickets.category` and `tickets.status = 'triaged'`.
3. Create a handoff task targeting `@cs/billing` or `@cs/tech`:
   ```json
   { "tool": "costate_handoff",
     "params": {
       "action": "create",
       "task": "Ticket T-4823 — please respond. Category: billing.",
       "to_agent": "agent_cs_billing_ulid",
       "payload_ref": "costate://<workspace_id>/tickets.sqlite"
     }
   }
   ```
4. Idempotency: pass `idempotency_key = "ticket-{id}"` so retries don't create duplicates.

**Escalation:** if unable to classify (ambiguous, multi-category, or angry
customer), set `status='triaged'`, `category=NULL`, and create a handoff to
a human with `needs_approval=true`.

## @cs/billing

**Role:** billing specialist.

**On connect:**
1. Read `policies/refunds.md`. That is your playbook.
2. `costate_handoff list --to_agent <your-ulid> --status submitted`.

**For each task:**
1. `costate_handoff claim` — atomic. If you lose the race, move on.
2. Fetch the ticket from `tickets.sqlite`.
3. Apply `policies/refunds.md`.
4. If auto-approved: write a response, update the row, `costate_handoff complete`.
5. If escalate: create a `needs_approval=true` sub-task for a human.

**Never** respond to a ticket whose `assigned_agent` is not you.

## @cs/tech

**Role:** technical specialist.

**On connect:**
1. Read `policies/tech.md`.
2. `costate_handoff list --to_agent <your-ulid> --status submitted`.

Same claim/answer/complete loop as @cs/billing but with the tech playbook.

## Human operator (via Control Tower)

Approves or rejects tasks in `requires_approval` state. Watches the activity
feed. Intervenes on stuck tasks past their `approval_deadline`.
