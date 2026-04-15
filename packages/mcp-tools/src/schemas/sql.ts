import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const SqlInput = z.object({
  ...workspaceIdField,
  query: z.string().max(10_000).describe('SQL query (SELECT, INSERT, UPDATE, DELETE, CREATE/DROP TABLE)'),
});
export type SqlInput = z.infer<typeof SqlInput>;

export const SqlOutput = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  count: z.number(),
  error: z.string().optional(),
});
export type SqlOutput = z.infer<typeof SqlOutput>;
