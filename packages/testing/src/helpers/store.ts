import { FileSystemStore } from '@costate-ai/shared';
import type { WorkspaceId } from '@costate-ai/shared';
import { createTestWorkspace } from '../fixtures/workspace.js';

export async function createTestStore(id?: WorkspaceId): Promise<{ store: FileSystemStore; dir: string }> {
  const wsId = id ?? `ws_test${Date.now()}` as WorkspaceId;
  const dir = await createTestWorkspace(wsId);
  const store = new FileSystemStore({ id: wsId, path: dir });
  await store.init();
  return { store, dir };
}
