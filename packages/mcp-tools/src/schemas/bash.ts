import { z } from 'zod';
import { BASH_MAX_TIMEOUT_MS } from '@costate-ai/shared/constants';
import { workspaceIdField } from './common.js';

export const BashInput = z.object({
  ...workspaceIdField,
  command: z.string().describe('Shell command'),
  timeout: z.number().max(BASH_MAX_TIMEOUT_MS).optional().describe('Timeout in ms (default 30s, max 120s)'),
});
export type BashInput = z.infer<typeof BashInput>;

export const BashOutput = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  timedOut: z.boolean(),
});
export type BashOutput = z.infer<typeof BashOutput>;
