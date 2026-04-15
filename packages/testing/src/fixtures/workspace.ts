import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileSystemStore } from '@costate-ai/shared';
import type { WorkspaceId } from '@costate-ai/shared';

const createdDirs: string[] = [];

export async function createTestWorkspace(id?: WorkspaceId): Promise<string> {
  const wsId = id ?? `ws_test${Date.now()}` as WorkspaceId;
  const dir = path.join(os.tmpdir(), 'costate-test', wsId);
  await fs.mkdir(dir, { recursive: true });
  createdDirs.push(dir);
  return dir;
}

export async function cleanupTestWorkspace(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

export async function cleanupAllTestWorkspaces(): Promise<void> {
  for (const dir of createdDirs) {
    await cleanupTestWorkspace(dir);
  }
  createdDirs.length = 0;
}
