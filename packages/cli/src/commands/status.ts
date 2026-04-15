import chalk from "chalk";
import { CostateClient } from "@costate-ai/sdk";
import { loadConfig, DEFAULT_SERVICE_URL } from "../config.js";
import { spinner, error as printError } from "../output.js";

/**
 * Show status for the default workspace (or a passed --workspace), via
 * costate_status. v0.1: raw JSON dump. Pretty table formatting lands when
 * the output schema is locked in @costate-ai/mcp.
 */
export async function runStatus(): Promise<void> {
  const config = await loadConfig();
  const url = config.url || DEFAULT_SERVICE_URL;

  if (!config.token) {
    printError("Not logged in. Run `costate login` first.");
    process.exit(1);
  }

  const spin = spinner("Connecting...");
  spin.start();

  const client = new CostateClient({
    url,
    token: config.token,
    workspaceId: config.workspaceId,
  });

  try {
    await client.connect();
    spin.text = "Fetching workspace status...";
    const status = await client.status();
    spin.stop();

    console.log();
    console.log(chalk.bold("Workspace Status"));
    console.log();
    console.log(JSON.stringify(status, null, 2));
    console.log();
    await client.close();
  } catch (err) {
    spin.stop();
    printError(`Failed: ${(err as Error).message}`);
    process.exit(1);
  }
}
