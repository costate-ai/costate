import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Persisted CLI config at ~/.costate/config.json. Mode 0600.
 *
 * This is the canonical shape for the fresh cloud-first CLI.
 */
export interface CostateConfig {
  /** Costate service URL, e.g. "https://api.costate.ai". */
  url?: string;
  /** Bearer token — Costate PAT (cst_...) or Cognito JWT. */
  token?: string;
  /** Default workspace ID auto-injected into scoped tool calls. */
  workspaceId?: string;
  /** User ID from the last successful login (informational). */
  userId?: string;
  /** Cognito Hosted UI URL (OAuth flow). */
  cognitoUrl?: string;
  /** Cognito app client ID. */
  cognitoClientId?: string;
}

const COSTATE_DIR = join(homedir(), ".costate");
const CONFIG_PATH = join(COSTATE_DIR, "config.json");

export const DEFAULT_SERVICE_URL = "https://api.costate.ai";

export async function loadConfig(): Promise<CostateConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as CostateConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: CostateConfig): Promise<void> {
  await mkdir(COSTATE_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  await chmod(CONFIG_PATH, 0o600);
}

export function getConfigDir(): string {
  return COSTATE_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
