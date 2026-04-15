import { z } from 'zod';
import { WEBHOOK_MAX_URL_LENGTH, WEBHOOK_BODY_TEMPLATE_MAX_LENGTH } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const AutomationInput = z.object({
  ...workspaceIdField,
  type: z.enum(['webhook', 'trigger']).describe('webhook = fire on file change, trigger = fire on JSON field change'),
  operation: z.enum(['create', 'list', 'delete']).describe('Operation'),
  // shared create params
  pattern: z.string().max(256).optional().describe('Glob pattern for file paths'),
  target_url: z.string().url().max(WEBHOOK_MAX_URL_LENGTH).optional().describe('POST target URL'),
  headers: z.record(z.string(), z.string()).optional().describe('Custom HTTP headers'),
  // webhook-specific
  body_template: z.string().max(WEBHOOK_BODY_TEMPLATE_MAX_LENGTH).optional()
    .describe('JSON template with {{file}}, {{event}}, {{author}}, {{commitHash}} (webhook only)'),
  // trigger-specific
  field: z.string().max(128).optional().describe('JSON field to monitor (trigger only)'),
  value: z.unknown().optional().describe('Fire when field equals this value (trigger only)'),
  // delete
  id: z.string().optional().describe('Webhook or trigger ID (for delete)'),
});
export type AutomationInput = z.infer<typeof AutomationInput>;
