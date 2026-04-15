import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const AgentsInput = z.object({ ...workspaceIdField });
export type AgentsInput = z.infer<typeof AgentsInput>;

export const AgentsOutput = z.object({
  agents: z.array(z.object({
    agentId: z.string(),
    lastSeen: z.string(),
    recentActions: z.number(),
  })),
  count: z.number(),
  connectedSessions: z.number().optional(),
  connectedAgents: z.array(z.string()).optional(),
});
export type AgentsOutput = z.infer<typeof AgentsOutput>;
