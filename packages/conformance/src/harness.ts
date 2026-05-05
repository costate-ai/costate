/**
 * Host-target abstraction for the Costate conformance suite.
 *
 * A `HostTarget` represents a Costate-compliant host plus an AAT (§1.8) plus
 * a workspace ID — the minimum needed to exercise §§3.x operations. All
 * tests in `src/tests/` operate through this abstraction so the suite is
 * portable across any host implementation.
 */

export interface HostTargetOptions {
  /** Base URL of the Costate host (e.g., `https://api.example.com`). No trailing slash required. */
  baseUrl: string;
  /** AAT (§1.8) authorizing the test caller. Must include all scopes the suite exercises. */
  aat: string;
  /** Workspace ID under test. The suite assumes write access and mutates the workspace. */
  workspaceId: string;
  /** Optional abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface HostResponse<TBody = unknown> {
  status: number;
  headers: Record<string, string>;
  body: TBody;
  rawText: string;
}

export class HostTarget {
  constructor(public readonly opts: HostTargetOptions) {}

  get workspaceId(): string {
    return this.opts.workspaceId;
  }

  /** Issue an HTTP request against the host with the AAT attached. */
  async request<TBody = unknown>(
    method: string,
    path: string,
    body?: string | Record<string, unknown> | unknown[],
    extraHeaders?: Record<string, string>,
  ): Promise<HostResponse<TBody>> {
    const base = this.opts.baseUrl.replace(/\/$/, "");
    const url = `${base}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.aat}`,
      ...extraHeaders,
    };
    let bodyInit: string | undefined;
    if (body !== undefined) {
      if (typeof body === "string") {
        bodyInit = body;
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/octet-stream";
        }
      } else {
        bodyInit = JSON.stringify(body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: bodyInit,
      signal: this.opts.signal,
    });

    const rawText = await res.text();
    let parsed: unknown;
    if (rawText.length === 0) {
      parsed = undefined;
    } else if (
      res.headers.get("content-type")?.includes("application/json") ?? false
    ) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }
    } else {
      parsed = rawText;
    }

    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: parsed as TBody,
      rawText,
    };
  }

  /** Convenience: build a path scoped to the test workspace. */
  wsPath(suffix = ""): string {
    return `/v1/workspaces/${encodeURIComponent(this.workspaceId)}${suffix}`;
  }
}

/** Throws if `cond` is falsy. Used by test bodies. */
export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/** Throws if `res.status !== expected`. */
export function assertStatus(
  res: HostResponse,
  expected: number,
  context?: string,
): void {
  if (res.status === expected) return;
  const bodyPreview =
    typeof res.body === "string"
      ? res.body.slice(0, 200)
      : JSON.stringify(res.body).slice(0, 200);
  throw new Error(
    `${context ? context + ": " : ""}expected status ${expected}, got ${res.status} (body: ${bodyPreview})`,
  );
}

/** Throws if `res.body.error.code !== expectedCode`. */
export function assertErrorCode(res: HostResponse, expectedCode: string): void {
  const body = res.body as { error?: { code?: string } } | undefined;
  const code = body?.error?.code;
  if (code !== expectedCode) {
    throw new Error(
      `expected error code "${expectedCode}", got "${code}" (status ${res.status})`,
    );
  }
}
