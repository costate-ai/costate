import {
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

interface McpErrorPayload {
  error: string;
  message: string;
  file?: string;
  expected_version?: string;
  current_version?: string;
  expired_at?: string;
}

/**
 * Parse an MCP error response into a typed CostateError.
 * The server serializes errors as JSON in content[0].text with an `error` code field.
 */
export function parseMcpError(content: Array<{ type: string; text: string }>): CostateError {
  let payload: McpErrorPayload;
  try {
    payload = JSON.parse(content[0].text) as McpErrorPayload;
  } catch {
    return new ConnectionError('Failed to parse error response');
  }

  const { error: code, message } = payload;

  switch (code) {
    case 'FILE_NOT_FOUND':
    case 'RESOURCE_NOT_FOUND':
      return new ResourceNotFoundError(message);
    case 'FILE_PAYLOAD_TOO_LARGE':
    case 'RESOURCE_PAYLOAD_TOO_LARGE': {
      const err = new PayloadTooLargeError(0, 0);
      err.message = message;
      return err;
    }
    case 'FILE_VALIDATION_ERROR':
    case 'RESOURCE_VALIDATION_ERROR':
      return new ValidationError(message);
    case 'CONCURRENCY_STALE_FENCE':
      return new StaleFenceError(message);
    case 'CONCURRENCY_VERSION_CONFLICT':
      return new VersionConflictError(
        payload.file ?? 'unknown',
        payload.expected_version ?? 'unknown',
        payload.current_version ?? 'unknown',
      );
    case 'AUTH_INVALID_API_KEY':
      return new InvalidApiKeyError(message);
    case 'AUTH_PERMISSION_DENIED':
      return new PermissionDeniedError(message);
    case 'AUTH_TOKEN_EXPIRED':
      return new TokenExpiredError(payload.expired_at ?? '', message);
    case 'AUTH_TOKEN_REVOKED':
      return new TokenRevokedError(message);
    case 'AUTH_PROVIDER_ERROR':
      return new AuthProviderError(message);
    case 'INFRA_CONNECTION_ERROR':
      return new ConnectionError(message);
    case 'INFRA_TIMEOUT':
      return new TimeoutError(message);
    case 'INFRA_THROTTLE':
      return new ThrottleError(message);
    case 'INFRA_RESOURCE_LIMIT':
      return new ResourceLimitError(message);
    default:
      return new ConnectionError(message || `Unknown error: ${code}`);
  }
}
