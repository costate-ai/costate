import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const UploadInput = z.object({
  ...workspaceIdField,
  file: z.string().describe('Target file path (e.g. "docs/report.pdf"). Converted markdown saved as "{file}.md".'),
  data: z.string().describe('Base64-encoded binary file content.'),
  format: z.enum(['pdf', 'docx', 'pptx', 'xlsx', 'html', 'csv', 'jpg', 'png', 'wav', 'mp3']).optional()
    .describe('Format hint. Auto-detected from file extension if omitted.'),
});
export type UploadInput = z.infer<typeof UploadInput>;

export const UploadOutput = z.object({
  file: z.string(),
  version: z.string(),
  format: z.string(),
  sizeOriginal: z.number(),
  sizeMarkdown: z.number(),
});
export type UploadOutput = z.infer<typeof UploadOutput>;
