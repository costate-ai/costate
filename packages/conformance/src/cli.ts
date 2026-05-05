#!/usr/bin/env node
/**
 * `costate-conformance` CLI entry point.
 *
 * Usage:
 *   costate-conformance --host <url> --aat <token> --workspace <id> [--section 3.2,3.3]
 *
 * Exits 0 if the host is conformant with the Costate base profile (no failures
 * in the required sections); 1 otherwise. Skipped tests and advisory
 * failures do not affect exit code.
 */

import { HostTarget } from "./harness.js";
import { formatReport, summarize } from "./reporter.js";
import { runAll, type SectionFilter } from "./index.js";

interface ParsedArgs {
  host?: string;
  aat?: string;
  workspace?: string;
  sections?: SectionFilter[];
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--help" || arg === "-h") {
      out.help = true;
    } else if (arg === "--host") {
      out.host = argv[++i];
    } else if (arg === "--aat") {
      out.aat = argv[++i];
    } else if (arg === "--workspace") {
      out.workspace = argv[++i];
    } else if (arg === "--section" || arg === "--sections") {
      const value = argv[++i] ?? "";
      out.sections = value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0) as SectionFilter[];
    } else if (arg.startsWith("--host=")) {
      out.host = arg.slice("--host=".length);
    } else if (arg.startsWith("--aat=")) {
      out.aat = arg.slice("--aat=".length);
    } else if (arg.startsWith("--workspace=")) {
      out.workspace = arg.slice("--workspace=".length);
    }
  }
  return out;
}

function printHelp(): void {
  process.stdout.write(
    [
      "costate-conformance — verify a host against the Costate spec",
      "",
      "USAGE:",
      "    costate-conformance --host <url> --aat <token> --workspace <id> [--section 3.2,3.3]",
      "",
      "REQUIRED:",
      "    --host <url>           Costate host base URL, e.g. https://api.example.com",
      "    --aat <token>          Agent Access Token (cst_aat_…) with scopes:",
      "                           files:write tasks:write activity:read grants:admin",
      "    --workspace <id>       Workspace ID under test (must be empty / disposable)",
      "",
      "OPTIONAL:",
      "    --section <list>       Comma-separated RFC sections to run (default: all)",
      "                           Available: 3.2 3.3 3.6 7.1",
      "    --help, -h             Show this help",
      "",
      "EXIT CODE:",
      "    0   Host is conformant with the Costate base profile",
      "    1   Host failed at least one required test",
      "",
      "REFERENCES:",
      "    Spec:  costate/docs/Costate-RFC-v0.1.md",
      "    Suite: costate/packages/conformance/",
      "",
    ].join("\n"),
  );
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return 0;
  }

  const missing: string[] = [];
  if (!args.host) missing.push("--host");
  if (!args.aat) missing.push("--aat");
  if (!args.workspace) missing.push("--workspace");
  if (missing.length > 0) {
    process.stderr.write(`error: missing required flag(s): ${missing.join(", ")}\n\n`);
    printHelp();
    return 2;
  }

  const host = new HostTarget({
    baseUrl: args.host!,
    aat: args.aat!,
    workspaceId: args.workspace!,
  });

  const suites = await runAll(host, args.sections);
  const report = formatReport(suites, args.host!);
  process.stdout.write(report + "\n");

  const summary = summarize(suites);
  return summary.conformant ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(
      `costate-conformance: unhandled error: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
