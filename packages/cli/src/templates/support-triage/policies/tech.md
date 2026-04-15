# Technical Support Playbook — @cs/tech

Read this before responding to any ticket with `category='tech'`.

## Tier 0 — Self-serve (answer immediately)

These have canned responses. Send the link, close the ticket.

| Symptom | Response |
|:--------|:---------|
| "Can't log in" | Password reset: `https://example.com/reset` |
| "App crashes on startup" | Clear cache guide: `https://example.com/docs/cache` |
| "How do I change my email" | Settings guide: `https://example.com/docs/email` |
| "Where's my invoice" | Billing portal: `https://example.com/billing` |

## Tier 1 — Diagnose

Ask for these three pieces of info before guessing:

1. OS + app version (screenshot of settings/about)
2. Exact error message (text or screenshot)
3. Steps to reproduce

Once you have them, search the `tickets_fts` table for similar past tickets:

```sql
SELECT id, subject, response FROM tickets_fts
  JOIN tickets ON tickets.rowid = tickets_fts.rowid
  WHERE tickets_fts MATCH '<keywords>'
    AND status = 'answered'
  LIMIT 5;
```

If a past answered ticket has the same symptoms, adapt its response.

## Tier 2 — Known open bugs

If the ticket matches one of these, acknowledge and set expectation:

- **BUG-1023**: iOS 18.2 push notification delay — WORKAROUND: toggle notifications off/on. Fix in 4.1.0 (ETA 2 weeks).
- **BUG-1041**: CSV export with > 10k rows times out — WORKAROUND: export in 5k chunks. Fix on roadmap.

When citing a bug, always include the bug ID and ETA if known.

## Tier 3 — Escalate

Create a handoff task to `@cs/eng` with `needs_approval=false`. Full customer
quote + repro steps in the `task` field. Don't respond to the customer until
engineering replies.

- Data loss / corruption claim
- Security concern (PII leak, unauthorized access)
- Performance regression after an update
- Anything you haven't seen before AND can't reproduce

## After every response

1. `tickets.status = 'answered'` if self-served, `'escalated'` otherwise.
2. `resolved_at = now()`.
3. `costate_handoff complete` with `result_ref` pointing at your response.
