import { randomBytes } from 'node:crypto';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config.js';
import { loadAuthSession } from '../auth.js';
import { createTable, success, error as printError } from '../output.js';

/**
 * Token creation: local mode generates locally, production calls server API.
 */
export async function runTokenCreate(): Promise<void> {
  const config = await loadConfig();

  if (isProductionServer(config.serverUrl)) {
    await createTokenRemote(config.serverUrl!);
    return;
  }

  // Local mode
  if (!config.userId) {
    printError('Not logged in. Run `costate login` first.');
    process.exit(1);
  }

  const token = `cst_${randomBytes(24).toString('base64url')}`;
  config.apiKey = token;
  await saveConfig(config);

  console.log();
  success('Token created');
  console.log();
  console.log(`  ${chalk.bold(token)}`);
  console.log();
  console.log(chalk.dim('Store this token securely — it will not be shown again.'));
  console.log();
}

export async function runTokenList(): Promise<void> {
  const config = await loadConfig();

  if (isProductionServer(config.serverUrl)) {
    await listTokensRemote(config.serverUrl!);
    return;
  }

  // Local mode
  if (!config.apiKey) {
    console.log(chalk.dim('\nNo tokens found. Run `costate token create` to generate one.\n'));
    return;
  }

  const table = createTable({ head: ['Token', 'User', 'Status'] });
  table.push([
    chalk.dim(config.apiKey.slice(0, 12) + '...'),
    config.userId || 'local-user',
    chalk.green('active'),
  ]);

  console.log();
  console.log(table.toString());
  console.log();
}

export async function runTokenRevoke(tokenId?: string): Promise<void> {
  const config = await loadConfig();

  if (isProductionServer(config.serverUrl)) {
    if (!tokenId) {
      printError('Usage: costate token revoke <token-hash>');
      process.exit(1);
    }
    await revokeTokenRemote(config.serverUrl!, tokenId);
    return;
  }

  // Local mode
  if (!config.apiKey) {
    printError('No active token to revoke.');
    process.exit(1);
  }

  const revoked = config.apiKey.slice(0, 12);
  config.apiKey = undefined;
  await saveConfig(config);

  console.log();
  success(`Token ${revoked}... revoked`);
  console.log();
}

// --- Remote (production) operations ---

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await loadAuthSession();
  if (!session.accessToken) {
    printError('Not authenticated. Run `costate login` first.');
    process.exit(1);
  }
  return { Authorization: `Bearer ${session.accessToken}` };
}

async function createTokenRemote(serverUrl: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${serverUrl}/auth/tokens`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    printError(`Failed to create token: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const data = await response.json() as any;

  console.log();
  success('Token created');
  console.log();
  console.log(`  ${chalk.bold(data.token)}`);
  console.log();
  console.log(chalk.dim('Store this token securely — it will not be shown again.'));
  console.log();
}

async function listTokensRemote(serverUrl: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${serverUrl}/auth/tokens`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    printError(`Failed to list tokens: ${response.status}`);
    process.exit(1);
  }

  const data = await response.json() as any;
  const tokens = data.tokens as Array<{ hash: string; agentId: string; workspaceRoles: Record<string, string>; createdAt: string; expiresAt: string }>;

  if (!tokens || tokens.length === 0) {
    console.log(chalk.dim('\nNo tokens found. Run `costate token create` to generate one.\n'));
    return;
  }

  const table = createTable({ head: ['Hash', 'Agent', 'Permissions', 'Expires'] });
  for (const t of tokens) {
    const perms = Object.entries(t.workspaceRoles)
      .map(([ws, role]) => ws === '*' ? `all:${role}` : `${ws}:${role}`)
      .join(', ');
    table.push([
      chalk.dim(t.hash.slice(0, 12) + '...'),
      t.agentId,
      perms,
      new Date(t.expiresAt).toLocaleDateString(),
    ]);
  }

  console.log();
  console.log(table.toString());
  console.log();
}

async function revokeTokenRemote(serverUrl: string, tokenHash: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${serverUrl}/auth/tokens/${tokenHash}`, {
    method: 'DELETE',
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

function isProductionServer(url?: string): boolean {
  if (!url) return false;
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}
