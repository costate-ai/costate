import { z } from 'zod';
import { MAX_WRITE_SIZE } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const WriteInput = z.object({
  ...workspaceIdField,
  file: z.string().describe('File path'),
  content: z.string().max(MAX_WRITE_SIZE).describe('Content to write'),
  version: z.string().optional().describe('Expected version for conflict detection'),
  schema: z.string().max(128).optional().describe('Schema name for validation'),
});
export type WriteInput = z.infer<typeof WriteInput>;

export const WriteOutput = z.object({
  file: z.string(),
  committed: z.boolean(),
  version: z.string().describe('Version hash for conflict detection'),
});
export type WriteOutput = z.infer<typeof WriteOutput>;
