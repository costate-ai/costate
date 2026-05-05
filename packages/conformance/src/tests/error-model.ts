/**
 * §3.6 Error Model — conformance tests.
 *
 * Spot-checks that the host emits the canonical error-code shape
 * (`{ error: { code, message, details? } }`) and uses the required
 * codes for known conditions.
 */

import { type HostTarget, assert, assertStatus, assertErrorCode } from "../harness.js";
import { TestSuite } from "../reporter.js";

export async function runErrorModelTests(host: HostTarget): Promise<TestSuite> {
  const suite = new TestSuite("§3.6 Error Model");

  await suite.run("missing Authorization header → 401 UNAUTHENTICATED", async () => {
    const base = host.opts.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/v1/workspaces/${encodeURIComponent(host.workspaceId)}/files?prefix=any`);
    assertStatus(
      { status: res.status, headers: {}, body: undefined, rawText: "" },
      401,
    );
  });

  await suite.run("nonexistent workspace → 404 NOT_FOUND", async () => {
    const res = await host.request(
      "GET",
      `/v1/workspaces/${encodeURIComponent("ws_does_not_exist_zzzz")}/files`,
    );
    assertStatus(res, 404);
    assertErrorCode(res, "NOT_FOUND");
  });

  await suite.run("malformed JSON body → 400", async () => {
    const base = host.opts.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}${host.wsPath("/tasks")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${host.opts.aat}`,
        "Content-Type": "application/json",
      },
      body: "{ this is not json",
    });
    assert(res.status === 400, `expected 400 on malformed JSON, got ${res.status}`);
  });

  return suite;
}
