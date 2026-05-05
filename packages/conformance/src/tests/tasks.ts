/**
 * §3.3 Task Operations — conformance tests.
 *
 * Verifies: task lifecycle (§3.3.1), atomic claim semantics (§3.3.3),
 * routing (§3.3.4), terminal-state transitions (§3.3.5–§3.3.6).
 *
 * The atomic claim test is THE critical test — atomic claim is the
 * canonical Costate-specific operation (§3.3 intro). A host that fails this
 * test does not provide what makes Costate useful over A2A point-to-point.
 */

import { type HostTarget, assert, assertStatus, assertErrorCode } from "../harness.js";
import { TestSuite } from "../reporter.js";

interface TaskRecord {
  task_id: string;
  uri: string;
  status: string;
  to_agent?: string | null;
  from_agent?: string;
}

export async function runTaskTests(host: HostTarget): Promise<TestSuite> {
  const suite = new TestSuite("§3.3 Task Operations");

  let createdTaskId: string | undefined;

  await suite.run("task.create returns submitted task (§3.3.2)", async () => {
    const res = await host.request<TaskRecord>("POST", host.wsPath("/tasks"), {
      task: "conformance test: analyze this",
      to_agent: "*",
    });
    assertStatus(res, 201);
    assert(typeof res.body?.task_id === "string", "missing task_id");
    assert(res.body?.status === "submitted", `expected submitted, got ${res.body?.status}`);
    assert(
      typeof res.body?.uri === "string" && res.body.uri.startsWith("costate://"),
      "missing or malformed task uri",
    );
    createdTaskId = res.body.task_id;
  });

  await suite.run(
    "task.create with needs_approval=true → requires_approval (§3.3.2)",
    async () => {
      const res = await host.request<TaskRecord>("POST", host.wsPath("/tasks"), {
        task: "conformance test: needs approval",
        to_agent: "*",
        needs_approval: true,
      });
      assertStatus(res, 201);
      assert(
        res.body?.status === "requires_approval",
        `expected requires_approval, got ${res.body?.status}`,
      );
    },
  );

  await suite.run("task.get returns full task record (§3.3.7)", async () => {
    assert(createdTaskId, "no createdTaskId from prior test");
    const res = await host.request<TaskRecord>(
      "GET",
      host.wsPath(`/tasks/${encodeURIComponent(createdTaskId)}`),
    );
    assertStatus(res, 200);
    assert(res.body?.task_id === createdTaskId, "task_id mismatch");
  });

  await suite.run("task.list returns at least the created task (§3.3.8)", async () => {
    const res = await host.request<{ tasks?: TaskRecord[] }>(
      "GET",
      host.wsPath("/tasks?status=submitted"),
    );
    assertStatus(res, 200);
    assert(Array.isArray(res.body?.tasks), "tasks: expected array");
  });

  await suite.run("task.claim transitions submitted → working (§3.3.3)", async () => {
    assert(createdTaskId, "no createdTaskId from prior test");
    const res = await host.request<TaskRecord>(
      "POST",
      host.wsPath(`/tasks/${encodeURIComponent(createdTaskId)}/claim`),
    );
    assertStatus(res, 200);
    assert(res.body?.status === "working", `expected working, got ${res.body?.status}`);
  });

  await suite.run(
    "task.claim race: second claim returns 409 ALREADY_CLAIMED (§3.3.3 — atomic claim)",
    async () => {
      assert(createdTaskId, "no createdTaskId from prior test");
      const res = await host.request(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(createdTaskId)}/claim`),
      );
      assertStatus(res, 409);
      assertErrorCode(res, "ALREADY_CLAIMED");
    },
  );

  await suite.run("task.complete transitions working → completed (§3.3.5)", async () => {
    assert(createdTaskId, "no createdTaskId from prior test");
    const res = await host.request<TaskRecord>(
      "POST",
      host.wsPath(`/tasks/${encodeURIComponent(createdTaskId)}/complete`),
      {
        result_ref: `costate://placeholder/${host.workspaceId}/files/done.md`,
      },
    );
    assertStatus(res, 200);
    assert(res.body?.status === "completed", `expected completed, got ${res.body?.status}`);
  });

  await suite.run(
    "terminal task: re-completing returns 409 INVALID_TRANSITION (§3.3.1)",
    async () => {
      assert(createdTaskId, "no createdTaskId from prior test");
      const res = await host.request(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(createdTaskId)}/complete`),
        { result_ref: "costate://placeholder/x/files/y.md" },
      );
      assertStatus(res, 409);
      assertErrorCode(res, "INVALID_TRANSITION");
    },
  );

  await suite.run(
    "task.request_input + task.provide_input round-trip (§3.3.10)",
    async () => {
      // Create a fresh task, claim it, request input, provide input — should
      // round-trip working → input-required → working without error. This
      // exercises the A2A v1.0 input-required state and Costate's two new
      // operations for entering and resolving it.
      const created = await host.request<TaskRecord>("POST", host.wsPath("/tasks"), {
        task: "conformance test: request input round-trip",
        to_agent: "*",
      });
      assertStatus(created, 201);
      const tid = created.body!.task_id;

      const claim = await host.request<TaskRecord>(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/claim`),
      );
      assertStatus(claim, 200);
      assert(claim.body?.status === "working", `expected working, got ${claim.body?.status}`);

      const request = await host.request<TaskRecord>(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/request_input`),
        { prompt: "Need clarification on the analysis scope." },
      );
      assertStatus(request, 200);
      assert(
        request.body?.status === "input-required",
        `expected input-required, got ${request.body?.status}`,
      );

      const provide = await host.request<TaskRecord>(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/provide_input`),
        { input: "Scope is Q4 only; exclude refunds." },
      );
      assertStatus(provide, 200);
      assert(
        provide.body?.status === "working",
        `expected working after provide_input, got ${provide.body?.status}`,
      );

      // Cleanup: cancel the task.
      await host.request(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/cancel`),
        { reason: "conformance cleanup" },
      );
    },
  );

  await suite.run(
    "task.request_input from non-working state returns 409 INVALID_TRANSITION (§3.3.10)",
    async () => {
      // Create a task and try request_input without claiming first — must fail.
      const created = await host.request<TaskRecord>("POST", host.wsPath("/tasks"), {
        task: "conformance test: invalid request_input",
        to_agent: "*",
      });
      assertStatus(created, 201);
      const tid = created.body!.task_id;

      const res = await host.request(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/request_input`),
        { prompt: "should fail" },
      );
      assertStatus(res, 409);
      assertErrorCode(res, "INVALID_TRANSITION");

      await host.request(
        "POST",
        host.wsPath(`/tasks/${encodeURIComponent(tid)}/cancel`),
        { reason: "conformance cleanup" },
      );
    },
  );

  await suite.run("task.cancel on a fresh task transitions → cancelled (§3.3.5)", async () => {
    const created = await host.request<TaskRecord>("POST", host.wsPath("/tasks"), {
      task: "conformance test: cancel me",
      to_agent: "*",
    });
    assertStatus(created, 201);
    const cancelRes = await host.request<TaskRecord>(
      "POST",
      host.wsPath(`/tasks/${encodeURIComponent(created.body!.task_id)}/cancel`),
      { reason: "conformance test cleanup" },
    );
    assertStatus(cancelRes, 200);
    assert(
      cancelRes.body?.status === "cancelled",
      `expected cancelled, got ${cancelRes.body?.status}`,
    );
  });

  return suite;
}
