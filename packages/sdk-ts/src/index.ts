/**
 * @costate-ai/sdk — TypeScript client for the Costate coordination service.
 */

// Main client
export { CostateClient } from "./client.js";
export type { CostateClientConfig } from "./types.js";

// Error parsing (for advanced use)
export { parseMcpError } from "./errors.js";

// Re-export input types for all 16 tools (call-site typing)
export type {
  ReadInput,
  WriteInput,
  EditInput,
  DeleteInput,
  ListInput,
  SearchInput,
  SqlInput,
  LogInput,
  WatchInput,
  StatusInput,
  SnapshotInput,
  SnapshotsInput,
  ListWorkspacesInput,
  WorkspaceInput,
  AccessInput,
  HandoffInput,
  ToolOutput,
  ToolDefinition,
} from "@costate-ai/mcp";

// Re-export error classes for catch handling (subpath avoids Node-only code)
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
} from "@costate-ai/shared/errors";
