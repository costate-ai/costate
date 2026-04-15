import { cp, readdir, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config.js';
import { loadAuthSession } from '../auth.js';
import { runLogin } from './login.js';
import { success, error as printError, warn, spinner } from '../output.js';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES_DIR = join(__dirname, '..', 'templates');

export async function listTemplates(): Promise<string[]> {
  try {
    const entries = await readdir(TEMPLATES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return ['blank', 'two-agents-chat', 'task-tracker'];
  }
}

function isRemoteServer(url?: string): boolean {
  if (!url) return false;
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}

export async function runInit(options: {
  template: string;
  name?: string;
  cloud?: boolean;
}): Promise<void> {
  const config = await loadConfig();

  // Cloud mode: create workspace on remote server
  if (options.cloud || isRemoteServer(config.serverUrl)) {
    await runCloudInit(options);
    return;
  }

  // Local mode: scaffold local workspace
  await runLocalInit(options);
}

/** Cloud init: create workspace on remote server, get a PAT, print MCP config. */
async function runCloudInit(options: { template: string; name?: string }): Promise<void> {
  const config = await loadConfig();

  if (!config.serverUrl) {
    printError('No server URL configured. Run `costate login` first or set serverUrl in ~/.costate/config.json');
    process.exit(1);
  }

  // Ensure authenticated
  let auth = await loadAuthSession();
  if (!auth.accessToken && !config.apiKey) {
    console.log(chalk.dim('\nNot authenticated. Starting login flow...\n'));
    await runLogin();
    auth = await loadAuthSession();
    if (!auth.accessToken && !config.apiKey) {
      printError('Authentication failed. Cannot create cloud workspace.');
      process.exit(1);
    }
  }

  const token = config.apiKey || auth.accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const spin = spinner('Creating cloud workspace...');
  spin.start();

  try {
    // Step 1: Create workspace
    const wsResponse = await fetch(`${config.serverUrl}/workspaces`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: options.name || `workspace-${nanoid(4)}`,
        template: options.template !== 'blank' ? options.template : undefined,
      }),
    });

    if (!wsResponse.ok) {
      const body = await wsResponse.json().catch(() => ({})) as any;
      spin.fail('Failed to create workspace');
      printError(body?.error?.message || `HTTP ${wsResponse.status}`);
      process.exit(1);
    }

    const workspace = await wsResponse.json() as { id: string; name: string };
    spin.text = 'Creating agent token...';

    // Step 2: Create a PAT for the workspace
    const agentId = `cli-${nanoid(4)}`;
    const tokenResponse = await fetch(`${config.serverUrl}/auth/tokens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId,
        workspaceRoles: { [workspace.id]: 'write' },
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.json().catch(() => ({})) as any;
      spin.fail('Failed to create agent token');
      printError(body?.error?.message || `HTTP ${tokenResponse.status}`);
      process.exit(1);
    }

    const tokenData = await tokenResponse.json() as { token: string; hash: string; agentId: string };
    spin.succeed('Cloud workspace created');

    // Save to config
    config.workspaceId = workspace.id;
    await saveConfig(config);

    // Print results
    console.log();
    success(`Workspace: ${chalk.bold(workspace.name)} (${chalk.cyan(workspace.id)})`);
    console.log(`  Agent:   ${chalk.cyan(tokenData.agentId)}`);
    console.log(`  Token:   ${chalk.dim(tokenData.token.slice(0, 16) + '...')}`);
    console.log();

    // Print MCP config JSON
    console.log(chalk.bold('MCP Server Config (paste into Claude Code / Cursor):'));
    console.log();
    const mcpConfig = {
      mcpServers: {
        costate: {
          url: `${config.serverUrl}/mcp?workspace=${workspace.id}`,
          headers: { Authorization: `Bearer ${tokenData.token}` },
        },
      },
    };
    console.log(chalk.green(JSON.stringify(mcpConfig, null, 2)));
    console.log();
    console.log(chalk.dim('Save this token — it won\'t be shown again.'));
    console.log();
  } catch (err) {
    spin.fail('Cloud init failed');
    printError((err as Error).message);
    process.exit(1);
  }
}

/** Local init: scaffold workspace directory with template files. */
async function runLocalInit(options: { template: string; name?: string }): Promise<void> {
  const { template, name } = options;
  const workspaceId = `ws_${nanoid(6)}`;
  const targetDir = resolve(name || '.');

  // Validate template
  const templates = await listTemplates();
  if (!templates.includes(template)) {
    printError(`Unknown template: ${template}`);
    console.log(`Available templates: ${templates.join(', ')}`);
    process.exit(1);
  }

  const templateDir = join(TEMPLATES_DIR, template);

  // Create target directory
  await mkdir(targetDir, { recursive: true });

  // Copy template files
  try {
    await cp(templateDir, targetDir, { recursive: true });
  } catch (err) {
    printError(`Failed to copy template: ${(err as Error).message}`);
    process.exit(1);
  }

  // Initialize git repo
  try {
    await exec('git', ['init'], { cwd: targetDir });
    await exec('git', ['add', '-A'], { cwd: targetDir });
    await exec('git', [
      '-c', 'user.name=costate',
      '-c', 'user.email=costate@local',
      'commit', '-m', `costate: init workspace ${workspaceId} from template ${template}`,
    ], { cwd: targetDir });
  } catch {
    warn('git init failed — you may need to initialize the repo manually');
  }

  console.log();
  success(`Workspace initialized: ${chalk.bold(workspaceId)}`);
  console.log();
  console.log(`  Template:  ${chalk.cyan(template)}`);
  console.log(`  Location:  ${chalk.dim(targetDir)}`);
  console.log();
  console.log(chalk.dim('Next steps:'));
  console.log(`  ${chalk.dim('$')} cd ${name || '.'}`);
  console.log(`  ${chalk.dim('$')} costate dev`);
  console.log();
}
