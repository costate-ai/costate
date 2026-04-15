import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CostateConfig {
  serverUrl?: string;
  apiKey?: string;
  userId?: string;
  workspaceId?: string;
  cognitoUrl?: string;
  cognitoClientId?: string;
}

const COSTATE_DIR = join(homedir(), '.costate');
const CONFIG_PATH = join(COSTATE_DIR, 'config.json');

export async function loadConfig(): Promise<CostateConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as CostateConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: CostateConfig): Promise<void> {
  await mkdir(COSTATE_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  await chmod(CONFIG_PATH, 0o600);
}

export function getConfigDir(): string {
  return COSTATE_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
