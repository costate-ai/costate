import { CostateError } from './base.js';

export class StaleFenceError extends CostateError {
  readonly code = 'CONCURRENCY_STALE_FENCE' as const;
  readonly statusCode = 409;

  constructor(message = 'Stale fencing token') {
    super(message);
  }
}

export class VersionConflictError extends CostateError {
  readonly code = 'CONCURRENCY_VERSION_CONFLICT' as const;
  readonly statusCode = 409;
  readonly currentVersion: string;
  readonly retryAfterMs: number;
  readonly guidance = 'This file was just modified. Re-read it with costate_read to get the current content, then retry your edit against the new version. If you get 3+ conflicts on the same file, consider working on a different file or coordinating with the other agent via costate_write to a shared plan.';

  constructor(file: string, expectedVersion: string, currentVersion: string) {
    super(
      `File "${file}" was modified by another agent (expected version ${expectedVersion}, current ${currentVersion}). Re-read the file to see their changes, then decide whether your edit is still needed.`,
    );
    this.currentVersion = currentVersion;
    // Random jitter for SDK clients to avoid thundering herd retries
    this.retryAfterMs = 100 + Math.floor(Math.random() * 400);
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      current_version: this.currentVersion,
      retry_after_ms: this.retryAfterMs,
      guidance: this.guidance,
    };
  }
}
