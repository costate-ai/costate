import chalk from "chalk";
import { CostateClient } from "@costate-ai/sdk";
import { loadConfig, DEFAULT_SERVICE_URL } from "../config.js";
import { success, error as printError } from "../output.js";

/**
 * Create an empty folder in the current workspace.
 *
 * The MCP schema requires folder URIs to end with `/`, so this command
 * appends one if the user didn't supply it. Parent folders are NOT auto-
 * created for `costate mkdir` — if you want nested, pass `a/b/c/`.
 */
export async function runMkdir(
  path: string,
  options: { workspace?: string },
): Promise<void> {
  const config = await loadConfig();
  const url = config.url || DEFAULT_SERVICE_URL;
  if (!config.token) {
    printError(
      "Not logged in. Run `costate login` or `costate token create --value <cst_...>`.",
    );
    process.exit(1);
  }
  const workspaceId = options.workspace || config.workspaceId;
  if (!workspaceId) {
    printError(
      "No workspace set. Pass `--workspace ws_...` or set `workspaceId` in ~/.costate/config.json.",
    );
    process.exit(1);
  }

  const uri = path.endsWith("/") ? path : `${path}/`;

  const client = new CostateClient({ url, token: config.token, workspaceId });
  try {
    await client.connect();
    await client.mkdir({ uri });
    await client.close();
  } catch (err) {
    printError((err as Error).message);
    process.exit(1);
  }

  success(`Created folder ${chalk.green(uri)}`);
}
