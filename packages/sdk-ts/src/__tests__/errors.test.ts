import { describe, it, expect } from 'vitest';
import { parseMcpError } from '../errors.js';
import {
  ResourceNotFoundError,
  PayloadTooLargeError,
  ValidationError,
  StaleFenceError,
  InvalidApiKeyError,
  PermissionDeniedError,
  TokenExpiredError,
  TokenRevokedError,
  ConnectionError,
  TimeoutError,
  ThrottleError,
  ResourceLimitError,
} from '@costate-ai/shared/errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorContent(code: string, message: string, extra?: Record<string, unknown>) {
  return [{ type: 'text', text: JSON.stringify({ error: code, message, ...extra }) }];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseMcpError', () => {
  // File errors
  it('FILE_NOT_FOUND → ResourceNotFoundError', () => {
    const err = parseMcpError(errorContent('FILE_NOT_FOUND', 'foo'));
    expect(err).toBeInstanceOf(ResourceNotFoundError);
    expect(err.code).toBe('FILE_NOT_FOUND');
    // ResourceNotFoundError constructor prepends "File not found: "
    expect(err.message).toBe('File not found: foo');
  });

  it('FILE_PAYLOAD_TOO_LARGE → PayloadTooLargeError', () => {
    const err = parseMcpError(errorContent('FILE_PAYLOAD_TOO_LARGE', 'Payload too large'));
    expect(err).toBeInstanceOf(PayloadTooLargeError);
    expect(err.code).toBe('FILE_PAYLOAD_TOO_LARGE');
    expect(err.message).toBe('Payload too large');
  });

  it('FILE_VALIDATION_ERROR → ValidationError', () => {
    const err = parseMcpError(errorContent('FILE_VALIDATION_ERROR', 'Invalid path'));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe('FILE_VALIDATION_ERROR');
    expect(err.message).toBe('Invalid path');
  });

  // Concurrency errors
  it('CONCURRENCY_STALE_FENCE → StaleFenceError', () => {
    const err = parseMcpError(errorContent('CONCURRENCY_STALE_FENCE', 'Stale fencing token'));
    expect(err).toBeInstanceOf(StaleFenceError);
    expect(err.code).toBe('CONCURRENCY_STALE_FENCE');
  });

  // Auth errors
  it('AUTH_INVALID_API_KEY → InvalidApiKeyError', () => {
    const err = parseMcpError(errorContent('AUTH_INVALID_API_KEY', 'Bad key'));
    expect(err).toBeInstanceOf(InvalidApiKeyError);
    expect(err.code).toBe('AUTH_INVALID_API_KEY');
    expect(err.message).toBe('Bad key');
  });

  it('AUTH_TOKEN_EXPIRED → TokenExpiredError with expiredAt', () => {
    const expiredAt = '2026-03-01T00:00:00.000Z';
    const err = parseMcpError(
      errorContent('AUTH_TOKEN_EXPIRED', 'Token expired', { expired_at: expiredAt }),
    );
    expect(err).toBeInstanceOf(TokenExpiredError);
    expect(err.code).toBe('AUTH_TOKEN_EXPIRED');
    const tokenErr = err as TokenExpiredError;
    expect(tokenErr.expiredAt).toBe(expiredAt);
  });

  it('AUTH_TOKEN_EXPIRED defaults to empty string when expired_at missing', () => {
    const err = parseMcpError(errorContent('AUTH_TOKEN_EXPIRED', 'Token expired'));
    expect(err).toBeInstanceOf(TokenExpiredError);
    const tokenErr = err as TokenExpiredError;
    expect(tokenErr.expiredAt).toBe('');
  });

  it('AUTH_TOKEN_REVOKED → TokenRevokedError', () => {
    const err = parseMcpError(errorContent('AUTH_TOKEN_REVOKED', 'Revoked'));
    expect(err).toBeInstanceOf(TokenRevokedError);
    expect(err.code).toBe('AUTH_TOKEN_REVOKED');
  });

  it('AUTH_PERMISSION_DENIED → PermissionDeniedError', () => {
    const err = parseMcpError(errorContent('AUTH_PERMISSION_DENIED', 'Not allowed'));
    expect(err).toBeInstanceOf(PermissionDeniedError);
    expect(err.code).toBe('AUTH_PERMISSION_DENIED');
  });

  // Infrastructure errors
  it('INFRA_CONNECTION_ERROR → ConnectionError', () => {
    const err = parseMcpError(errorContent('INFRA_CONNECTION_ERROR', 'Cannot connect'));
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.code).toBe('INFRA_CONNECTION_ERROR');
  });

  it('INFRA_TIMEOUT → TimeoutError', () => {
    const err = parseMcpError(errorContent('INFRA_TIMEOUT', 'Timed out'));
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.code).toBe('INFRA_TIMEOUT');
  });

  it('INFRA_THROTTLE → ThrottleError', () => {
    const err = parseMcpError(errorContent('INFRA_THROTTLE', 'Too many requests'));
    expect(err).toBeInstanceOf(ThrottleError);
    expect(err.code).toBe('INFRA_THROTTLE');
  });

  it('INFRA_RESOURCE_LIMIT → ResourceLimitError', () => {
    const err = parseMcpError(errorContent('INFRA_RESOURCE_LIMIT', 'Disk full'));
    expect(err).toBeInstanceOf(ResourceLimitError);
    expect(err.code).toBe('INFRA_RESOURCE_LIMIT');
  });

  // Unknown / fallback
  it('unknown error code falls back to ConnectionError', () => {
    const err = parseMcpError(errorContent('SOMETHING_UNKNOWN', 'Weird error'));
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toBe('Weird error');
  });

  it('unknown code with empty message uses fallback message', () => {
    const err = parseMcpError(errorContent('WEIRD_CODE', ''));
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toBe('Unknown error: WEIRD_CODE');
  });

  // Malformed content
  it('unparseable JSON falls back to ConnectionError', () => {
    const err = parseMcpError([{ type: 'text', text: 'not valid json {{{' }]);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.message).toBe('Failed to parse error response');
  });
});
