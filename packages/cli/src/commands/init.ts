import { cp, readdir, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  DEFAULT_SERVICE_URL,
} from "../config.js";
import { loadAuthSession } from "../auth.js";
import { runLogin } from "./login.js";
import { success, error as printError, warn, spinner } from "../output.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "templates");

export async function listTemplates(): Promise<string[]> {
  try {
    const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return ["blank"];
  }
}

/**
 * Scaffold a new agent workspace from a template and connect it to the
 * Costate service. Output includes a ready-to-paste MCP config snippet.
 *
 * Flow:
 *   1. Ensure authenticated (browser login if not)
 *   2. Create workspace on the service
 *   3. Mint a PAT scoped to the new workspace
 *   4. Copy template files (if any) into the target directory
 *   5. Print the MCP config JSON for Claude Desktop / Cursor / Code
 */
export async function runInit(options: {
  template: string;
  name?: string;
}): Promise<void> {
  const config = await loadConfig();
  const serviceUrl = config.url || DEFAULT_SERVICE_URL;

  let auth = await loadAuthSession();
  if (!auth.accessToken && !config.token) {
    console.log(chalk.dim("\nNot authenticated. Starting login flow...\n"));
    await runLogin();
    auth = await loadAuthSession();
    if (!auth.accessToken && !config.token) {
      printError("Authentication failed.");
      process.exit(1);
    }
  }

  const bearer = config.token || auth.accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearer}`,
  };

  const spin = spinner("Creating workspace...");
  spin.start();

  try {
    const wsRes = await fetch(`${serviceUrl}/workspaces`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: options.name || `workspace-${nanoid(4)}`,
        template: options.template !== "blank" ? options.template : undefined,
      }),
    });

    if (!wsRes.ok) {
      const body = (await wsRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      spin.fail("Failed to create workspace");
      printError(body?.error?.message || `HTTP ${wsRes.status}`);
      process.exit(1);
    }

    const workspace = (await wsRes.json()) as { id: string; name: string };
    spin.text = "Minting agent token...";

    const agentId = `cli-${nanoid(4)}`;
    const tokenRes = await fetch(`${serviceUrl}/auth/tokens`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        agentId,
        workspaceRoles: { [workspace.id]: "write" },
      }),
    });

    if (!tokenRes.ok) {
      const body = (await tokenRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      spin.fail("Failed to mint token");
      printError(body?.error?.message || `HTTP ${tokenRes.status}`);
      process.exit(1);
    }

    const tokenData = (await tokenRes.json()) as {
      token: string;
      agentId: string;
    };
    spin.succeed("Workspace ready");

    // Optionally copy template files into the target directory
    const templates = await listTemplates();
    const targetDir = resolve(options.name || ".");
    if (options.template !== "blank" && templates.includes(options.template)) {
      await mkdir(targetDir, { recursive: true });
      try {
        await cp(join(TEMPLATES_DIR, options.template), targetDir, {
          recursive: true,
        });
      } catch (err) {
        warn(`Template copy failed: ${(err as Error).message}`);
      }
    }

    config.workspaceId = workspace.id;
    config.url = serviceUrl;
    await saveConfig(config);

    console.log();
    success(
      `Workspace: ${chalk.bold(workspace.name)} (${chalk.cyan(workspace.id)})`,
    );
    console.log(`  Agent:   ${chalk.cyan(tokenData.agentId)}`);
    console.log(`  Token:   ${chalk.dim(tokenData.token.slice(0, 16) + "...")}`);
    console.log();

    console.log(
      chalk.bold("MCP server config (paste into Claude Desktop / Cursor / Code):"),
    );
    console.log();
    const mcpConfig = {
      mcpServers: {
        costate: {
          command: "npx",
          args: [
            "@costate-ai/cli",
            "mcp",
            "--url",
            serviceUrl,
            "--token",
            tokenData.token,
            "--workspace",
            workspace.id,
          ],
        },
      },
    };
    console.log(chalk.green(JSON.stringify(mcpConfig, null, 2)));
    console.log();
    console.log(chalk.dim("Save this token — it will not be shown again."));
    console.log();
  } catch (err) {
    spin.fail("Init failed");
    printError((err as Error).message);
    process.exit(1);
  }
}
