import { CostateError } from './base.js';

export class InvalidApiKeyError extends CostateError {
  readonly code = 'AUTH_INVALID_API_KEY' as const;
  readonly statusCode = 401;

  constructor(message = 'Invalid API key') {
    super(message);
  }
}

export class PermissionDeniedError extends CostateError {
  readonly code = 'AUTH_PERMISSION_DENIED' as const;
  readonly statusCode = 403;

  constructor(message = 'Permission denied') {
    super(message);
  }
}

export class TokenExpiredError extends CostateError {
  readonly code = 'AUTH_TOKEN_EXPIRED' as const;
  readonly statusCode = 401;
  readonly expiredAt: string;

  constructor(expiredAt: string, message?: string) {
    super(message ?? `Token expired at ${expiredAt}`);
    this.expiredAt = expiredAt;
  }

  override toJSON() {
    return { ...super.toJSON(), expired_at: this.expiredAt };
  }
}

export class TokenRevokedError extends CostateError {
  readonly code = 'AUTH_TOKEN_REVOKED' as const;
  readonly statusCode = 401;

  constructor(message = 'Token has been revoked') {
    super(message);
  }
}

export class TokenInactiveError extends CostateError {
  readonly code = 'AUTH_TOKEN_INACTIVE' as const;
  readonly statusCode = 401;

  constructor(message = 'Your token has been deactivated. Contact your admin to reactivate it.') {
    super(message);
  }
}

export class AuthProviderError extends CostateError {
  readonly code = 'AUTH_PROVIDER_ERROR' as const;
  readonly statusCode = 502;

  constructor(message = 'Authentication provider error') {
    super(message);
  }
}
