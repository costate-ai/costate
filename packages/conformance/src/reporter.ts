/**
 * Test result aggregation and report formatting for the Costate conformance suite.
 */

export type TestStatus = "pass" | "fail" | "skip" | "advisory-fail";

export interface TestResult {
  section: string;
  name: string;
  status: TestStatus;
  message?: string;
  durationMs?: number;
}

export class TestSuite {
  readonly results: TestResult[] = [];

  constructor(public readonly section: string) {}

  /** Run a test. If it throws, record a `fail` (or `advisory-fail` if opts.advisory). */
  async run(
    name: string,
    fn: () => Promise<void> | void,
    opts: { advisory?: boolean } = {},
  ): Promise<void> {
    const start = Date.now();
    try {
      await fn();
      this.results.push({
        section: this.section,
        name,
        status: "pass",
        durationMs: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.results.push({
        section: this.section,
        name,
        status: opts.advisory ? "advisory-fail" : "fail",
        message,
        durationMs: Date.now() - start,
      });
    }
  }

  skip(name: string, reason: string): void {
    this.results.push({ section: this.section, name, status: "skip", message: reason });
  }
}

export interface ReportSummary {
  totalRequired: number;
  passed: number;
  failed: number;
  skipped: number;
  advisoryFailed: number;
  conformant: boolean;
}

export function summarize(suites: TestSuite[]): ReportSummary {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let advisoryFailed = 0;
  for (const suite of suites) {
    for (const r of suite.results) {
      switch (r.status) {
        case "pass":
          passed++;
          break;
        case "fail":
          failed++;
          break;
        case "skip":
          skipped++;
          break;
        case "advisory-fail":
          advisoryFailed++;
          break;
      }
    }
  }
  return {
    totalRequired: passed + failed,
    passed,
    failed,
    skipped,
    advisoryFailed,
    conformant: failed === 0,
  };
}

export function formatReport(suites: TestSuite[], target: string): string {
  const lines: string[] = [];
  lines.push("Costate Conformance Test Suite (v0.1.0-draft)");
  lines.push(`Target: ${target}`);
  lines.push("");

  for (const suite of suites) {
    const counts = countBy(suite.results);
    const total = suite.results.length;
    const passed = counts.pass ?? 0;
    const tag =
      counts.fail || counts["advisory-fail"]
        ? `${passed}/${total} passed`
        : `${passed}/${total} passed`;
    const skipNote = counts.skip ? ` (${counts.skip} skipped)` : "";
    const advisoryNote =
      counts["advisory-fail"]
        ? ` (${counts["advisory-fail"]} advisory failure${counts["advisory-fail"] === 1 ? "" : "s"})`
        : "";
    lines.push(
      pad(suite.section, 32) + tag + skipNote + advisoryNote,
    );
    for (const r of suite.results) {
      if (r.status === "fail" || r.status === "advisory-fail") {
        lines.push(`    ✗ ${r.name}`);
        if (r.message) lines.push(`      ${r.message}`);
      }
    }
  }

  lines.push("");
  const summary = summarize(suites);
  const overall = summary.conformant ? "CONFORMANT (base profile)" : "NON-CONFORMANT";
  lines.push(`OVERALL: ${overall}`);
  lines.push(
    `        — ${summary.passed}/${summary.totalRequired} required tests passed, ${summary.skipped} skipped, ${summary.failed} base-profile failures.`,
  );
  if (summary.advisoryFailed > 0) {
    lines.push(
      `        — ${summary.advisoryFailed} advisory failure${summary.advisoryFailed === 1 ? "" : "s"} (do not affect conformance status).`,
    );
  }
  return lines.join("\n");
}

function countBy(results: TestResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of results) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}

function pad(s: string, width: number): string {
  if (s.length >= width) return s + " ";
  return s + " ".repeat(width - s.length);
}
