import { randomBytes } from 'node:crypto';
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigPath } from '../config.js';
import { browserLogin, saveAuthSession } from '../auth.js';
import { success } from '../output.js';

export async function runLogin(options?: { headless?: boolean }): Promise<void> {
  const config = await loadConfig();

  // Production mode: Cognito SSO
  if (config.serverUrl && !config.serverUrl.includes('localhost') && !config.serverUrl.includes('127.0.0.1')) {
    const cognitoUrl = config.cognitoUrl;
    const clientId = config.cognitoClientId;

    if (!cognitoUrl || !clientId) {
      console.log(chalk.red('\nMissing Cognito configuration. Set cognitoUrl and cognitoClientId in config.\n'));
      process.exit(1);
    }

    if (options?.headless) {
      console.log(chalk.yellow('\nHeadless (device code) flow not yet implemented.'));
      console.log('Use browser-based login or set COSTATE_API_KEY environment variable.\n');
      return;
    }

    console.log(chalk.dim('\nOpening browser for Cognito SSO login...\n'));
    const session = await browserLogin(cognitoUrl, clientId);
    await saveAuthSession(session);

    console.log();
    success('Logged in via Cognito SSO');
    console.log(chalk.dim(`  Session expires: ${session.expiresAt}`));
    console.log();
    return;
  }

  // Local dev mode: generate a local API key
  if (config.apiKey) {
    console.log();
    console.log(`Already logged in as ${chalk.cyan(config.userId || 'local-user')}`);
    console.log(chalk.dim(`Config: ${getConfigPath()}`));
    console.log();
    return;
  }

  const apiKey = `cst_${randomBytes(24).toString('base64url')}`;
  const userId = `user_${randomBytes(4).toString('hex')}`;

  config.apiKey = apiKey;
  config.userId = userId;
  config.serverUrl = config.serverUrl || 'http://localhost:3000';

  await saveConfig(config);

  console.log();
  success('Logged in (local dev mode)');
  console.log();
  console.log(`  User:   ${chalk.cyan(userId)}`);
  console.log(`  Token:  ${chalk.dim(apiKey.slice(0, 12) + '...')}`);
  console.log(`  Config: ${chalk.dim(getConfigPath())}`);
  console.log();
  console.log(chalk.dim('Note: In production, `costate login` opens Cognito SSO in your browser.'));
  console.log();
}
