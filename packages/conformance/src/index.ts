/**
 * @costate-ai/conformance
 *
 * Conformance test suite for the Costate.
 * Run against any Costate-compliant host to verify it implements the spec.
 *
 * Public API:
 *   - `HostTarget` — host abstraction
 *   - `runAll(host)` — run every test suite, return aggregated results
 *   - individual `run<X>Tests(host)` runners for selective execution
 *   - `formatReport`, `summarize` — output helpers
 *
 * See README.md for usage and the Costate spec at
 * `costate/docs/Costate-RFC-v0.1.md` for the spec being verified.
 */

export {
  HostTarget,
  type HostTargetOptions,
  type HostResponse,
  assert,
  assertStatus,
  assertErrorCode,
} from "./harness.js";

export {
  TestSuite,
  type TestStatus,
  type TestResult,
  type ReportSummary,
  summarize,
  formatReport,
} from "./reporter.js";

import type { HostTarget } from "./harness.js";
import type { TestSuite } from "./reporter.js";

import { runFileTests } from "./tests/files.js";
import { runTaskTests } from "./tests/tasks.js";
import { runCapabilityTests } from "./tests/capabilities.js";
import { runErrorModelTests } from "./tests/error-model.js";
import { runGrantsAndSubscriptionsTests } from "./tests/grants-and-subscriptions.js";

export {
  runFileTests,
  runTaskTests,
  runCapabilityTests,
  runErrorModelTests,
  runGrantsAndSubscriptionsTests,
};

/**
 * Section identifiers accepted by `runAll`'s `sections` filter.
 * Match the §-prefixes used by `TestSuite.section`.
 */
export type SectionFilter = "3.2" | "3.3" | "3.6" | "7.1" | "4.5" | "6.2";

const ALL_RUNNERS: Array<{
  section: SectionFilter;
  run: (host: HostTarget) => Promise<TestSuite>;
}> = [
  { section: "3.2", run: runFileTests },
  { section: "3.3", run: runTaskTests },
  { section: "3.6", run: runErrorModelTests },
  { section: "7.1", run: runCapabilityTests },
  { section: "4.5", run: runGrantsAndSubscriptionsTests },
];

/**
 * Run all (or a filtered subset of) conformance test suites against `host`.
 *
 * @param host - The Costate host under test
 * @param sections - Optional filter; if omitted, runs all suites
 * @returns Array of `TestSuite` with results, in execution order
 */
export async function runAll(
  host: HostTarget,
  sections?: SectionFilter[],
): Promise<TestSuite[]> {
  const filter = sections ? new Set(sections) : null;
  const out: TestSuite[] = [];
  for (const runner of ALL_RUNNERS) {
    if (filter && !filter.has(runner.section)) continue;
    out.push(await runner.run(host));
  }
  return out;
}
