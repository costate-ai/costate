import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const EditInput = z.object({
  ...workspaceIdField,
  file: z.string().describe('File path'),
  old_string: z.string().describe('Exact string to find (must be unique)'),
  new_string: z.string().describe('Replacement string'),
  version: z.string().optional().describe('Expected version for conflict detection'),
});
export type EditInput = z.infer<typeof EditInput>;

export const EditOutput = z.object({
  file: z.string(),
  committed: z.boolean(),
  version: z.string().describe('Version hash for conflict detection'),
});
export type EditOutput = z.infer<typeof EditOutput>;
