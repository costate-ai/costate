# Refund Policy — @cs/billing

Read this before responding to any ticket with `category='billing'`.

## Auto-approved refunds

Approve and process immediately. No escalation.

- Duplicate charge on the same order (same amount within 24h)
- Failed delivery confirmed by carrier tracking > 14 days past expected
- Subscription charged after documented cancellation (`support@` reply within 30 days)
- Unauthorized charge on a flagged stolen card

Response template:

> Hi {name}, I see the duplicate/failed/unauthorized charge on order {id}.
> I've refunded ${amount} to your original payment method — it should
> appear within 5–7 business days. Anything else I can help with?

## Conditional refunds (partial)

Approve up to 50% of the order value. Explain the partial amount.

- Item arrived damaged but customer wants to keep it
- Order shipped late but arrived (compensate shipping cost)
- Minor quality issue on a consumable (food, candles, soap)

## Escalate to human (requires_approval)

Create a handoff with `needs_approval=true` targeting the human operator:

- Refund request > $500
- Customer claims fraud but card is not flagged
- Repeat refund pattern from same customer (3+ in 90 days)
- Chargeback threat or mention of legal/press

## Never refund

Respond firmly but politely.

- Change-of-mind after the 30-day window
- Used / partially consumed beyond reasonable trial
- Gift cards and digital codes already redeemed

## After every response

1. Update `tickets.status = 'answered'`, set `resolved_at = now()`.
2. Mark the handoff task `complete`.
3. If you escalated, set `status = 'escalated'` and leave the task in
   `requires_approval` for the Control Tower.
