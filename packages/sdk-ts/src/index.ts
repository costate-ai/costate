// Main client
export { CostateClient } from './client.js';
export type { CostateClientConfig } from './types.js';

// Error parsing (for advanced use)
export { parseMcpError } from './errors.js';

// Re-export types from @costate-ai/mcp for convenience
export type {
  ReadOutput,
  WriteOutput,
  EditOutput,
  DeleteOutput,
  SearchGlobOutput,
  SearchGrepOutput,
  GitDiffOutput,
  GitLogOutput,
  BashOutput,
  WatchOutput,
  StatusOutput,
  AgentsOutput,
  SqlOutput,
} from '@costate-ai/mcp';

// Re-export error classes from @costate-ai/shared/errors for catch handling
// (sub-path import avoids pulling in Node.js-only store code for browser consumers)
export {
  CostateError,
  ResourceNotFoundError,
  PayloadTooLargeError,
  ValidationError,
  StaleFenceError,
  VersionConflictError,
  InvalidApiKeyError,
  PermissionDeniedError,
  TokenExpiredError,
  TokenRevokedError,
  AuthProviderError,
  ConnectionError,
  TimeoutError,
  ThrottleError,
  ResourceLimitError,
} from '@costate-ai/shared/errors';
