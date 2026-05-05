/**
 * §3.2 File Operations — conformance tests.
 *
 * Verifies: file.read, file.write, file.delete, file.list, including
 * required `If-Match` semantics (§3.2.2) and `409 VERSION_MISMATCH` on
 * stale-version writes (§3.2.2 / §3.6).
 */

import { type HostTarget, assert, assertStatus, assertErrorCode } from "../harness.js";
import { TestSuite } from "../reporter.js";

export async function runFileTests(host: HostTarget): Promise<TestSuite> {
  const suite = new TestSuite("§3.2 File Operations");
  const testPath = `conformance/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const wsPath = (suffix = "") => host.wsPath(`/files/${testPath}${suffix}`);
  let createdVersion: string | undefined;

  await suite.run("rejects file.write without If-Match (§3.2.2)", async () => {
    const res = await host.request("PUT", wsPath(), "hello");
    assertStatus(res, 400, "missing If-Match must 400");
    assertErrorCode(res, "PRECONDITION_REQUIRED");
  });

  await suite.run("file.write with If-Match: * creates file (§3.2.2)", async () => {
    const res = await host.request<{ version?: string; uri?: string }>(
      "PUT",
      wsPath(),
      "hello world",
      { "If-Match": "*", "Content-Type": "text/plain" },
    );
    assert(
      res.status === 200 || res.status === 201,
      `expected 200 or 201, got ${res.status}`,
    );
    assert(typeof res.body?.version === "string" && res.body.version.length > 0, "response missing version");
    assert(
      typeof res.body?.uri === "string" && res.body.uri.startsWith("costate://"),
      "response missing or malformed uri",
    );
    createdVersion = res.body.version;
  });

  await suite.run("file.read returns content + X-Costate-Version (§3.2.1)", async () => {
    const res = await host.request<string>("GET", wsPath());
    assertStatus(res, 200);
    assert(res.body === "hello world", `unexpected content: ${String(res.body).slice(0, 80)}`);
    const version = res.headers["x-costate-version"];
    assert(typeof version === "string" && version.length > 0, "missing X-Costate-Version header");
  });

  await suite.run("file.write with stale If-Match returns 409 VERSION_MISMATCH (§3.2.2)", async () => {
    const res = await host.request("PUT", wsPath(), "stale write", {
      "If-Match": "definitely-not-the-current-version",
      "Content-Type": "text/plain",
    });
    assertStatus(res, 409);
    assertErrorCode(res, "VERSION_MISMATCH");
  });

  await suite.run("file.write with current If-Match succeeds (§3.2.2)", async () => {
    assert(createdVersion, "no createdVersion captured from prior test");
    const res = await host.request<{ version?: string }>("PUT", wsPath(), "updated content", {
      "If-Match": createdVersion,
      "Content-Type": "text/plain",
    });
    assertStatus(res, 200);
    assert(
      typeof res.body?.version === "string" && res.body.version !== createdVersion,
      "version did not advance after successful write",
    );
    createdVersion = res.body.version;
  });

  await suite.run("file.list includes the test file (§3.2.4)", async () => {
    const res = await host.request<{ files?: Array<{ uri: string }> }>(
      "GET",
      host.wsPath(`/files?prefix=conformance/`),
    );
    assertStatus(res, 200);
    assert(Array.isArray(res.body?.files), "files: expected array");
    const found = res.body!.files!.some((f) => f.uri.endsWith(`/${testPath}`));
    assert(found, `test file ${testPath} not found in list`);
  });

  await suite.run("file.delete removes the file (§3.2.3)", async () => {
    const res = await host.request("DELETE", wsPath(), undefined, {
      "If-Match": "*",
    });
    assertStatus(res, 204);
  });

  await suite.run("file.read on deleted file returns 404 NOT_FOUND (§3.6)", async () => {
    const res = await host.request("GET", wsPath());
    assertStatus(res, 404);
    assertErrorCode(res, "NOT_FOUND");
  });

  return suite;
}
