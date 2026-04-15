import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  DEFAULT_SERVICE_URL,
} from "../config.js";
import { loadAuthSession } from "../auth.js";
import { createTable, success, error as printError } from "../output.js";

/**
 * Token (PAT) management: always talks to the Costate service. Local generation
 * is gone — PATs are issued by the service against an authenticated session.
 *
 * Requires a prior `costate login` to obtain a Cognito JWT, which authorizes
 * these calls.
 */

async function authHeaders(): Promise<Record<string, string>> {
  const session = await loadAuthSession();
  if (!session.accessToken) {
    printError("Not authenticated. Run `costate login` first.");
    process.exit(1);
  }
  return { Authorization: `Bearer ${session.accessToken}` };
}

function serviceUrl(config: { url?: string }): string {
  return config.url || DEFAULT_SERVICE_URL;
}

/**
 * Two modes:
 *  - `costate token create` (no value): asks the service to mint a PAT for
 *    the authenticated session. Returns the token string to stash.
 *  - `costate token create --value <cst_...>`: stashes a PAT the user pasted
 *    from the web UI. No service round-trip. Useful before `costate login`
 *    works end-to-end.
 */
export async function runTokenCreate(options?: {
  value?: string;
}): Promise<void> {
  const config = await loadConfig();

  if (options?.value) {
    config.token = options.value;
    config.url = config.url || DEFAULT_SERVICE_URL;
    await saveConfig(config);
    console.log();
    success("Token stashed in config");
    console.log();
    return;
  }

  const headers = await authHeaders();
  const url = serviceUrl(config);
  const response = await fetch(`${url}/auth/tokens`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
  });
  if (!response.ok) {
    printError(`Failed to create token: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const data = (await response.json()) as { token: string };

  console.log();
  success("Token created");
  console.log();
  console.log(`  ${chalk.bold(data.token)}`);
  console.log();
  console.log(chalk.dim("Store this token securely — it will not be shown again."));
  console.log();
}

export async function runTokenList(): Promise<void> {
  const config = await loadConfig();
  const headers = await authHeaders();
  const url = serviceUrl(config);

  const response = await fetch(`${url}/auth/tokens`, {
    method: "GET",
    headers,
  });
  if (!response.ok) {
    printError(`Failed to list tokens: ${response.status}`);
    process.exit(1);
  }
  const data = (await response.json()) as {
    tokens?: Array<{
      hash: string;
      agentId: string;
      workspaceRoles: Record<string, string>;
      createdAt: string;
      expiresAt: string;
    }>;
  };
  const tokens = data.tokens ?? [];

  if (tokens.length === 0) {
    console.log(
      chalk.dim("\nNo tokens found. Run `costate token create` to generate one.\n"),
    );
    return;
  }

  const table = createTable({ head: ["Hash", "Agent", "Permissions", "Expires"] });
  for (const t of tokens) {
    const perms = Object.entries(t.workspaceRoles)
      .map(([ws, role]) => (ws === "*" ? `all:${role}` : `${ws}:${role}`))
      .join(", ");
    table.push([
      chalk.dim(t.hash.slice(0, 12) + "..."),
      t.agentId,
      perms,
      new Date(t.expiresAt).toLocaleDateString(),
    ]);
  }

  console.log();
  console.log(table.toString());
  console.log();
}

export async function runTokenRevoke(tokenHash?: string): Promise<void> {
  if (!tokenHash) {
    printError("Usage: costate token revoke <token-hash>");
    process.exit(1);
  }

  const config = await loadConfig();
  const headers = await authHeaders();
  const url = serviceUrl(config);

  const response = await fetch(`${url}/auth/tokens/${tokenHash}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    printError(`Failed to revoke token: ${response.status}`);
    process.exit(1);
  }

  console.log();
  success(`Token ${tokenHash.slice(0, 12)}... revoked`);
  console.log();
}
