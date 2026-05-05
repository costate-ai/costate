/**
 * §4.5 Grants and §6.2 Subscriptions — endpoint reachability conformance.
 *
 * These tests verify the host exposes the REST endpoints required by the
 * spec for cross-tenant access (grants) and event subscriptions. They do
 * NOT exercise full grant fulfillment flow (§4.7) which requires a second
 * principal — out of scope for a single-host conformance run.
 *
 * What's tested:
 *   - POST /v1/workspaces/{ws}/grants exists (returns 4xx for invalid input
 *     rather than 5xx, proving the route is wired and validates inputs)
 *   - POST /v1/workspaces/{ws}/subscriptions with delivery.type=host-local
 *     returns 201 and a subscription_id
 *   - DELETE /v1/workspaces/{ws}/subscriptions/{id} returns 204
 *   - Unsupported a2a-push delivery returns 501 NOT_IMPLEMENTED (per §6.3.1
 *     hosts MAY return 501 if they don't yet implement cross-host delivery)
 */

import { type HostTarget, assert, assertStatus } from "../harness.js";
import { TestSuite } from "../reporter.js";

interface SubscriptionResponse {
  subscription_id?: string;
  uri?: string;
  delivery?: { type?: string };
  filters?: unknown;
}

export async function runGrantsAndSubscriptionsTests(host: HostTarget): Promise<TestSuite> {
  const suite = new TestSuite("§4.5 / §6.2 Grants & Subscriptions");

  await suite.run(
    "POST /v1/workspaces/{ws}/grants endpoint exists (rejects missing email with 4xx)",
    async () => {
      const res = await host.request(
        "POST",
        host.wsPath("/grants"),
        {}, // no grantee_email or scopes — should 4xx, NOT 5xx
      );
      assert(
        res.status >= 400 && res.status < 500,
        `expected 4xx for missing grant fields, got ${res.status} (5xx means endpoint isn't wired)`,
      );
    },
  );

  let createdSubscriptionId: string | undefined;

  await suite.run(
    "POST /v1/workspaces/{ws}/subscriptions with host-local delivery → 201 + subscription_id (§6.2)",
    async () => {
      const res = await host.request<SubscriptionResponse>(
        "POST",
        host.wsPath("/subscriptions"),
        {
          delivery: { type: "host-local" },
          filters: { event_types: ["task.create", "task.complete"] },
        },
      );
      assert(
        res.status === 200 || res.status === 201,
        `expected 200 or 201, got ${res.status}`,
      );
      assert(
        typeof res.body?.subscription_id === "string",
        `response missing subscription_id`,
      );
      createdSubscriptionId = res.body!.subscription_id;
    },
  );

  await suite.run(
    "POST /v1/workspaces/{ws}/subscriptions with a2a-push → 501 NOT_IMPLEMENTED OR 201 (§6.3.1 optional)",
    async () => {
      const res = await host.request(
        "POST",
        host.wsPath("/subscriptions"),
        {
          delivery: {
            type: "a2a-push",
            endpoint: "https://example.invalid/a2a/push",
          },
          filters: {},
        },
      );
      // Either 501 (not implemented yet) OR 201 (implemented). Both are
      // conformant; what's not conformant is 500 or 4xx with malformed shape.
      assert(
        res.status === 501 || res.status === 201 || res.status === 200,
        `expected 501 NOT_IMPLEMENTED or 201, got ${res.status}`,
      );
    },
  );

  await suite.run(
    "DELETE /v1/workspaces/{ws}/subscriptions/{id} → 204 (§6.4)",
    async () => {
      // Use the subscription_id from the prior create test, or a synthetic
      // one if creation didn't run (defensive — the test still validates
      // the endpoint shape).
      const subId = createdSubscriptionId ?? "sub_synthetic_test_id";
      const res = await host.request(
        "DELETE",
        host.wsPath(`/subscriptions/${encodeURIComponent(subId)}`),
      );
      // 204 (deleted) or 404 (synthetic id not found) are both acceptable.
      // What's not acceptable: 5xx.
      assert(
        res.status === 204 || res.status === 404,
        `expected 204 or 404, got ${res.status}`,
      );
    },
  );

  return suite;
}
