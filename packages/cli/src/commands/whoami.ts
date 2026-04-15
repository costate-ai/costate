import chalk from 'chalk';
import { loadConfig, getConfigPath } from '../config.js';
import { error as printError } from '../output.js';

export async function runWhoami(): Promise<void> {
  const config = await loadConfig();

  if (!config.userId && !config.apiKey) {
    printError('Not logged in. Run `costate login` first.');
    process.exit(1);
  }

  console.log();
  console.log(chalk.bold('Costate Identity'));
  console.log();
  console.log(`  User:       ${chalk.cyan(config.userId || 'unknown')}`);
  console.log(`  Server:     ${chalk.dim(config.serverUrl || 'http://localhost:3000')}`);
  console.log(`  Workspace:  ${config.workspaceId ? chalk.cyan(config.workspaceId) : chalk.dim('not set')}`);
  console.log(`  Token:      ${config.apiKey ? chalk.green('active') : chalk.red('none')}`);
  console.log(`  Config:     ${chalk.dim(getConfigPath())}`);
  console.log();
}
