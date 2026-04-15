import { Command } from 'commander';
import { runDev } from './commands/dev.js';
import { runInit, listTemplates } from './commands/init.js';
import { runStatus } from './commands/status.js';
import { runLogin } from './commands/login.js';
import { runTokenCreate, runTokenList, runTokenRevoke } from './commands/token.js';
import { runWhoami } from './commands/whoami.js';
import { runDoctor } from './commands/doctor.js';
import { runDemo } from './commands/demo.js';
import { runMcpProxy } from './commands/mcp-proxy.js';

const program = new Command();

program
  .name('costate')
  .description('Shared state for the agent economy')
  .version('0.1.0');

program
  .command('dev')
  .description('Start a local Costate dev server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-w, --workspace-id <id>', 'Workspace ID (auto-generated if not set)')
  .action(runDev);

program
  .command('init')
  .description('Initialize a new workspace from a template')
  .option('-t, --template <name>', 'Template name', 'blank')
  .option('-n, --name <dir>', 'Directory name for the workspace')
  .action(runInit);

program
  .command('status')
  .description('Show workspace status and active agents')
  .action(runStatus);

program
  .command('login')
  .description('Authenticate with Costate (local dev mode in Phase 1)')
  .action(runLogin);

const token = program
  .command('token')
  .description('Manage API tokens');

token
  .command('create')
  .description('Generate a new API token')
  .action(runTokenCreate);

token
  .command('list')
  .description('List active tokens')
  .action(runTokenList);

token
  .command('revoke')
  .description('Revoke the active token')
  .action(runTokenRevoke);

program
  .command('whoami')
  .description('Show current identity and configuration')
  .action(runWhoami);

program
  .command('doctor')
  .description('Check system requirements and server connectivity')
  .action(runDoctor);

program
  .command('demo')
  .description('Run a two-agent collaboration demo')
  .action(runDemo);

program
  .command('mcp')
  .description('Start a stdio MCP proxy (for Claude Desktop / Cursor)')
  .option('-u, --url <url>', 'Costate server URL', 'http://localhost:3000')
  .option('-t, --token <token>', 'API token (cst_...). Also reads COSTATE_API_KEY env var.')
  .action(runMcpProxy);

export { program };
