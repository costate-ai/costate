import { CostateError } from './base.js';

export class ConnectionError extends CostateError {
  readonly code = 'INFRA_CONNECTION_ERROR' as const;
  readonly statusCode = 503;

  constructor(message = 'Connection error') {
    super(message);
  }
}

export class TimeoutError extends CostateError {
  readonly code = 'INFRA_TIMEOUT' as const;
  readonly statusCode = 504;

  constructor(message = 'Operation timed out') {
    super(message);
  }
}

export class ThrottleError extends CostateError {
  readonly code = 'INFRA_THROTTLE' as const;
  readonly statusCode = 429;

  constructor(message = 'Rate limit exceeded') {
    super(message);
  }
}

export class ResourceLimitError extends CostateError {
  readonly code = 'INFRA_RESOURCE_LIMIT' as const;
  readonly statusCode = 507;

  constructor(message: string) {
    super(message);
  }
}
