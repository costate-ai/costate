import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const MessageInput = z.object({
  ...workspaceIdField,
  operation: z.enum(['send', 'list', 'read']).describe('Operation'),
  to: z.string().max(128).optional().describe('Recipient agent ID (for send)'),
  content: z.string().max(4096).optional().describe('Message content (for send)'),
  type: z.enum(['text', 'handoff', 'request']).optional().describe('Message type (default: text)'),
  message_id: z.string().optional().describe('Message ID (for read/mark as read)'),
  filter_status: z.enum(['unread', 'read', 'all']).optional().describe('Filter (default: unread)'),
});
export type MessageInput = z.infer<typeof MessageInput>;
