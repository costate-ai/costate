import { z } from 'zod';

/** Shared workspace_id field — required on every workspace-scoped tool call. */
export const workspaceIdField = {
  workspace_id: z.string().regex(/^ws_[a-zA-Z0-9_-]+$/).describe('Workspace ID. Call costate_workspace_list to find available workspace IDs.'),
};
