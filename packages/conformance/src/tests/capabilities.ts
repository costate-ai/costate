/**
 * §7.1 Capability Discovery — conformance tests.
 *
 * Verifies the host exposes a `/v1/capabilities` endpoint that names
 * `costate.core` and `costate.subscription` (the REQUIRED minimum for
 * conformance per §7.1).
 */

import { type HostTarget, assert, assertStatus } from "../harness.js";
import { TestSuite } from "../reporter.js";

export async function runCapabilityTests(host: HostTarget): Promise<TestSuite> {
  const suite = new TestSuite("§7.1 Capability Discovery");

  await suite.run("GET /v1/capabilities returns 200 with version + capabilities array", async () => {
    const res = await host.request<{ version?: string; capabilities?: string[] }>(
      "GET",
      "/v1/capabilities",
    );
    assertStatus(res, 200);
    assert(typeof res.body?.version === "string", "missing version");
    assert(Array.isArray(res.body?.capabilities), "capabilities: expected array");
  });

  await suite.run(
    "host advertises costate.core and costate.subscription (REQUIRED per §7.1)",
    async () => {
      const res = await host.request<{ capabilities?: string[] }>("GET", "/v1/capabilities");
      assertStatus(res, 200);
      const caps = res.body?.capabilities ?? [];
      assert(caps.includes("costate.core"), "host MUST advertise costate.core");
      assert(caps.includes("costate.subscription"), "host MUST advertise costate.subscription");
    },
  );

  return suite;
}
