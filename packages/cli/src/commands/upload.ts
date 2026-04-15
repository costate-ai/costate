import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, extname } from "node:path";
import { stat } from "node:fs/promises";
import chalk from "chalk";
import { CostateClient } from "@costate-ai/sdk";
import {
  loadConfig,
  DEFAULT_SERVICE_URL,
} from "../config.js";
import { spinner, success, error as printError, warn } from "../output.js";

const exec = promisify(execFile);

/**
 * Convert a local file to Markdown via Microsoft's markitdown, then write the
 * result to the current workspace via costate_write.
 *
 * Supported formats (anything markitdown supports): PDF, DOCX, PPTX, XLSX,
 * images (with OCR), audio (with transcription), HTML, CSV, JSON, XML, EPUB,
 * ZIP, YouTube URLs.
 *
 * Prereq: `pip install 'markitdown[all]'` (or `pipx install markitdown`).
 * The CLI stays Node-only; markitdown is spawned as a subprocess.
 */
export async function runUpload(
  path: string,
  options: { as?: string; workspace?: string },
): Promise<void> {
  // 1. Verify markitdown is on PATH
  try {
    await exec("markitdown", ["--help"]);
  } catch {
    printError(
      "markitdown not found on PATH. Install with:\n" +
        "  pipx install 'markitdown[all]'\n" +
        "or\n" +
        "  pip install 'markitdown[all]'\n\n" +
        "Source: https://github.com/microsoft/markitdown",
    );
    process.exit(1);
  }

  // 2. Verify source exists
  try {
    const info = await stat(path);
    if (!info.isFile()) {
      printError(`Not a file: ${path}`);
      process.exit(1);
    }
  } catch {
    printError(`File not found: ${path}`);
    process.exit(1);
  }

  // 3. Resolve workspace + auth
  const config = await loadConfig();
  const url = config.url || DEFAULT_SERVICE_URL;
  if (!config.token) {
    printError("Not logged in. Run `costate login` or `costate token create --value <cst_...>`.");
    process.exit(1);
  }
  const workspaceId = options.workspace || config.workspaceId;
  if (!workspaceId) {
    printError(
      "No workspace set. Pass `--workspace ws_...` or set `workspaceId` in ~/.costate/config.json.",
    );
    process.exit(1);
  }

  // 4. Derive target URI
  const targetUri = options.as || `${basename(path, extname(path))}.md`;

  // 5. Convert
  const spin = spinner(`Converting ${chalk.cyan(path)} with markitdown...`);
  spin.start();
  let markdown: string;
  try {
    // markitdown prints markdown to stdout. Large PDFs may produce >1MB of
    // text; Node's default maxBuffer is 1MB, so bump it.
    const { stdout, stderr } = await exec("markitdown", [path], {
      maxBuffer: 64 * 1024 * 1024,
    });
    markdown = stdout;
    if (stderr && stderr.trim()) {
      // markitdown sometimes writes informational notes to stderr. Surface
      // them as warnings but don't fail the run.
      warn(stderr.trim());
    }
  } catch (err) {
    spin.fail("Conversion failed");
    printError((err as Error).message);
    process.exit(1);
  }

  if (!markdown.trim()) {
    spin.fail("markitdown produced no output");
    process.exit(1);
  }

  // 6. Write to workspace
  spin.text = `Writing to ${chalk.cyan(targetUri)}...`;
  const client = new CostateClient({
    url,
    token: config.token,
    workspaceId,
  });
  try {
    await client.connect();
    await client.write({ uri: targetUri, content: markdown });
    await client.close();
  } catch (err) {
    spin.fail("Workspace write failed");
    printError((err as Error).message);
    process.exit(1);
  }

  spin.succeed("Uploaded");
  console.log();
  console.log(`  ${chalk.cyan(path)}  →  ${chalk.green(targetUri)}`);
  console.log(`  ${chalk.dim(`Workspace: ${workspaceId}`)}`);
  console.log(`  ${chalk.dim(`Markdown size: ${formatBytes(markdown.length)}`)}`);
  console.log();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
