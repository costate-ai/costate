import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const DeleteInput = z.object({
  ...workspaceIdField,
  file: z.string().describe('File path'),
  version: z.string().optional().describe('Expected version for conflict detection'),
});
export type DeleteInput = z.infer<typeof DeleteInput>;

export const DeleteOutput = z.object({
  file: z.string(),
  deleted: z.boolean(),
  commitHash: z.string().optional(),
});
export type DeleteOutput = z.infer<typeof DeleteOutput>;
