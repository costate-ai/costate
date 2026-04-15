import { z } from 'zod';
import { COMMIT_HASH_PATTERN } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const ReadInput = z.object({
  ...workspaceIdField,
  file: z.string().describe('File path'),
  at: z.string().regex(COMMIT_HASH_PATTERN).optional().describe('Commit hash for historical version'),
});
export type ReadInput = z.infer<typeof ReadInput>;

export const ReadOutput = z.object({
  file: z.string(),
  content: z.string(),
  size: z.number(),
  version: z.string().optional(),
  lastModified: z.string(),
  commitHash: z.string().optional(),
});
export type ReadOutput = z.infer<typeof ReadOutput>;
