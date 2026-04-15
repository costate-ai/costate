import { z } from 'zod';
import { LOG_MAX_LIMIT } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const GitInput = z.object({
  ...workspaceIdField,
  operation: z.enum(['diff', 'log']).describe('Operation: diff = show changes, log = commit history'),
  // diff params
  from: z.string().optional().describe('Start commit hash (diff)'),
  to: z.string().optional().describe('End commit hash (diff)'),
  // shared
  file: z.string().optional().describe('Filter to specific file'),
  // log params
  limit: z.number().max(LOG_MAX_LIMIT).optional().describe('Max log entries (default 50, max 200)'),
});
export type GitInput = z.infer<typeof GitInput>;

export const GitDiffOutput = z.object({
  diff: z.string(),
  truncated: z.boolean(),
});
export type GitDiffOutput = z.infer<typeof GitDiffOutput>;

export const GitLogOutput = z.object({
  entries: z.array(z.object({
    commitHash: z.string(),
    message: z.string(),
    author: z.string(),
    timestamp: z.string(),
  })),
  count: z.number(),
});
export type GitLogOutput = z.infer<typeof GitLogOutput>;
