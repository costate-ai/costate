import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const TaskInput = z.object({
  ...workspaceIdField,
  operation: z.enum(['create', 'list', 'claim', 'complete', 'update', 'delete']).describe('Operation'),
  title: z.string().max(256).optional().describe('Task title (for create)'),
  description: z.string().max(4096).optional().describe('Task description'),
  assignee: z.string().max(128).optional().describe('Agent ID to assign'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority (default: medium)'),
  task_id: z.string().optional().describe('Task ID (for claim/complete/update/delete)'),
  result: z.string().max(4096).optional().describe('Completion result'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe('New status (for update)'),
  filter_status: z.enum(['pending', 'in_progress', 'completed', 'cancelled', 'all']).optional()
    .describe('Filter by status (default: non-completed)'),
  filter_assignee: z.string().max(128).optional().describe('Filter by assignee'),
});
export type TaskInput = z.infer<typeof TaskInput>;
