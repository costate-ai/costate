import { z } from 'zod';
import { workspaceIdField } from './common.js';

export const SearchInput = z.object({
  ...workspaceIdField,
  glob: z.string().optional().describe('Glob pattern for file matching (e.g. "**/*.json"). Lists files when used alone.'),
  content: z.string().optional().describe('Regex to search within file contents. When set, performs grep.'),
  query: z.string().optional().describe('Natural language search query with relevance ranking. Supports OR, "exact phrase", -exclude. Returns ranked results with snippets.'),
  maxResults: z.number().optional().describe('Max results (for content/query search)'),
});
export type SearchInput = z.infer<typeof SearchInput>;

export const SearchGlobOutput = z.object({
  files: z.array(z.string()),
  count: z.number(),
});
export type SearchGlobOutput = z.infer<typeof SearchGlobOutput>;

export const SearchGrepOutput = z.object({
  results: z.array(z.object({
    file: z.string(),
    line: z.number(),
    content: z.string(),
  })),
  count: z.number(),
});
export type SearchGrepOutput = z.infer<typeof SearchGrepOutput>;

export const SearchFTSOutput = z.object({
  results: z.array(z.object({
    file: z.string(),
    snippet: z.string(),
    score: z.number(),
  })),
  count: z.number(),
});
export type SearchFTSOutput = z.infer<typeof SearchFTSOutput>;
