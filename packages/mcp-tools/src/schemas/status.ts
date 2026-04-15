import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const StatusInput = z.object({ ...workspaceIdField });
export type StatusInput = z.infer<typeof StatusInput>;

export const StatusOutput = z.object({
  id: z.string(),
  fileCount: z.number(),
  totalSize: z.number(),
  commitCount: z.number(),
  activeAgents: z.array(z.string()),
  lastActivity: z.string().nullable(),
  database: z.object({ tables: z.array(z.string()) }).optional(),
});
export type StatusOutput = z.infer<typeof StatusOutput>;
