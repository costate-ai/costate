import { z } from 'zod';
import { MAX_WATCH_PER_POLL, WAIT_FOR_MAX_TIMEOUT_MS } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const WatchInput = z.object({
  ...workspaceIdField,
  // Poll mode params
  cursor: z.string().optional().describe('Cursor from previous poll (poll mode)'),
  limit: z.number().max(MAX_WATCH_PER_POLL).optional().describe('Max events per poll (default 20, max 100)'),
  // Subscribe/blocking mode params
  pattern: z.string().max(256).optional().describe('Glob pattern for file changes (required for blocking mode)'),
  timeout: z.number().min(0).max(WAIT_FOR_MAX_TIMEOUT_MS).optional()
    .describe('Block until change or timeout in ms (enables blocking mode, default 5min, max 30min)'),
});
export type WatchInput = z.infer<typeof WatchInput>;

export const WatchOutput = z.object({
  events: z.array(z.object({
    type: z.enum(['write', 'edit', 'delete', 'bash']),
    file: z.string(),
    author: z.string(),
    commitHash: z.string(),
    timestamp: z.string(),
  })),
  cursor: z.string(),
  hasMore: z.boolean(),
});
export type WatchOutput = z.infer<typeof WatchOutput>;
