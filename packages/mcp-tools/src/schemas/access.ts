import { z } from 'zod';
import { workspaceIdField } from './common.js';

const AGENT_ID_REGEX = /^[a-z0-9-]{1,64}$/;

const AccessGrantInput = z.object({
  ...workspaceIdField,
  operation: z.literal('grant'),
  agentId: z.string().regex(AGENT_ID_REGEX).describe('Agent ID to grant access to.'),
  role: z.enum(['admin', 'write', 'read']).default('write').describe('Role to grant. Default: write.'),
  message: z.string().max(500).optional().describe('Message for the invited agent (e.g., "Review draft.md").'),
});

const AccessRevokeInput = z.object({
  ...workspaceIdField,
  operation: z.literal('revoke'),
  agentId: z.string().regex(AGENT_ID_REGEX).describe('Agent ID to revoke access from.'),
});

const AccessListInput = z.object({
  ...workspaceIdField,
  operation: z.literal('list'),
});

export const AccessInput = z.discriminatedUnion('operation', [
  AccessGrantInput, AccessRevokeInput, AccessListInput,
]);
export type AccessInput = z.infer<typeof AccessInput>;
