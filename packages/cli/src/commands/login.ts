import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  DEFAULT_SERVICE_URL,
} from "../config.js";
import { browserLogin, saveAuthSession } from "../auth.js";
import { success, error as printError } from "../output.js";

/**
 * Authenticate with the Costate service via browser OAuth (Cognito Hosted UI).
 *
 * v0.1: requires `cognitoUrl` and `cognitoClientId` to be present in config.
 * Future: a `costate config set cognito ...` command and/or auto-discovery via
 * the service's `/.well-known/costate-config` endpoint.
 *
 * Alternative: run `costate token create` after obtaining a PAT through the web UI.
 */
export async function runLogin(): Promise<void> {
  const config = await loadConfig();
  const { cognitoUrl, cognitoClientId } = config;

  if (!cognitoUrl || !cognitoClientId) {
    printError(
      "Cognito OAuth not configured. Get a PAT from the Costate web UI and run:\n" +
        "  costate token create --value <cst_...>\n\n" +
        "Or set cognitoUrl + cognitoClientId in ~/.costate/config.json.",
    );
    process.exit(1);
  }

  console.log(chalk.dim("\nOpening browser for Costate SSO login...\n"));
  const session = await browserLogin(cognitoUrl, cognitoClientId);
  await saveAuthSession(session);

  // Stash JWT so the SDK + MCP bridge can use it.
  if (session.accessToken) {
    config.token = session.accessToken;
    config.url = config.url || DEFAULT_SERVICE_URL;
    await saveConfig(config);
  }

  console.log();
  success("Logged in via Costate SSO");
  console.log(chalk.dim(`  Session expires: ${session.expiresAt}`));
  console.log(chalk.dim(`  Config: ${getConfigPath()}`));
  console.log();
}
