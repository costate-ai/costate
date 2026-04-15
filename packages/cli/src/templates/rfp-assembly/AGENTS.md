# Agent Roster — RFP Assembly

## @sales/lead (you, probably)

**Role:** project manager. Reads the inbound RFP, creates handoff tasks for
each section. You operate through a `costate_handoff create` loop —
one task per section, routed to the right drafter.

**Starter prompt:**

> Read `rfp-inbound.md` from the workspace (your lead uploaded it during
> setup — extracted from the original PDF and saved via `costate_write`).
> Break it into 8–12 sections. For each:
> - Create a handoff task. `to_agent` = `@sales/drafter` for narrative sections,
>   `@finance/pricer` for pricing/T&Cs, `@external/legal` for clauses.
> - `payload_ref` = `costate://<ws>/rfp-inbound.md#section-N`.
> - `idempotency_key` = `rfp-section-N` (retry-safe).
> Write a top-level `drafts/_index.md` tracking all tasks and their status.

## @sales/drafter

**Role:** narrative writer.

**Loop:**
1. `costate_handoff list --to_agent <me> --status submitted`
2. For each: `claim` → read `payload_ref` → write to `drafts/<section>.md`
   referencing `company-context.md`.
3. If the section touches a clause (indemnity, liability, IP), add an entry
   in `legal-review.md` pointing at your draft, then `complete` the task
   with a note "pending legal."
4. Otherwise `complete` the task directly.

## @finance/pricer

**Role:** commercial specialist. Same loop as @sales/drafter but for pricing,
commercial terms, SLA credits, payment schedules. Writes to
`drafts/pricing.md`, `drafts/sla.md`, `drafts/payment.md`.

Always adds clause-level questions to `legal-review.md` — pricing often has
commercial T&Cs that need legal eyes.

## @external/legal (cross-tenant)

**Role:** outside counsel agent. Lives in the law firm's tenant, granted
`write` role on this workspace via `costate_access grant`.

**Loop:**
1. Read `legal-review.md` — the file is their single source of input.
2. For each section with `Status: [blank]`, read the linked draft.
3. Update the status to 🟢/🟡/🔴 and write comments inline.
4. When every section is 🟢 or 🟡, set the final sign-off field to
   "clear to submit" and `complete` their review task.

## Human operator

**Role:** final approver via Control Tower.

When `@sales/lead` creates the assembly task with `needs_approval=true`, you
see it in the Control Tower. Click **Approve** to unblock assembly, or
**Reject** with a reason to send it back for fixes.

## Workflow at a glance

```
┌─────────────┐  tasks   ┌────────────────┐   writes   ┌──────────────┐
│ @sales/lead │ ────────▶│ @sales/drafter │  drafts/  ─▶│ legal-review │
└─────────────┘          └────────────────┘            │ .md          │
       │                 ┌────────────────┐            │              │
       └──────tasks─────▶│ @finance/pricer│  drafts/  ─▶│              │
                         └────────────────┘            └──────┬───────┘
                                                              │
                                          status + comments  │
                                                       ◀──────┤
                                 ┌──────────────────────────┐ │
                                 │ @external/legal          │ │
                                 │ (cross-tenant grant)     │─┘
                                 └──────────────────────────┘
                                              │
                                              │ "clear to submit"
                                              ▼
                              ┌────────────────────────────────┐
                              │ assembly task (needs_approval) │
                              └───────────────┬────────────────┘
                                              │ human clicks Approve
                                              ▼
                                         final.pdf sent
```
