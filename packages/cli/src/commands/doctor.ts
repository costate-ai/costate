import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";
import { createTable, success, error as printError } from "../output.js";
import { loadConfig, DEFAULT_SERVICE_URL } from "../config.js";

const exec = promisify(execFile);

interface Check {
  name: string;
  run: () => Promise<{ ok: boolean; detail: string }>;
}

const checks: Check[] = [
  {
    name: "Node.js ≥ 22",
    run: async () => {
      const major = parseInt(process.versions.node.split(".")[0], 10);
      return { ok: major >= 22, detail: `v${process.versions.node}` };
    },
  },
  {
    name: "git available",
    run: async () => {
      try {
        const { stdout } = await exec("git", ["--version"]);
        return { ok: true, detail: stdout.trim() };
      } catch {
        return { ok: false, detail: "not found" };
      }
    },
  },
  {
    name: "Service reachable",
    run: async () => {
      const config = await loadConfig();
      const url = config.url || DEFAULT_SERVICE_URL;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          return { ok: true, detail: `${url} → 200 OK` };
        }
        return { ok: false, detail: `${url} → ${res.status}` };
      } catch {
        clearTimeout(timer);
        return { ok: false, detail: `${url} → unreachable` };
      }
    },
  },
  {
    name: "Authentication",
    run: async () => {
      const config = await loadConfig();
      if (config.token) return { ok: true, detail: "token present" };
      return { ok: false, detail: "no token — run `costate login`" };
    },
  },
];

export async function runDoctor(): Promise<void> {
  console.log(chalk.bold("\nCostate Doctor\n"));

  const table = createTable({ head: ["Check", "Status", "Detail"] });
  let allOk = true;

  for (const check of checks) {
    const result = await check.run();
    if (!result.ok) allOk = false;
    table.push([
      check.name,
      result.ok ? chalk.green("✓ pass") : chalk.red("✗ fail"),
      result.detail,
    ]);
  }

  console.log(table.toString());
  console.log();

  if (allOk) {
    success("All checks passed");
  } else {
    printError("Some checks failed");
  }
}
