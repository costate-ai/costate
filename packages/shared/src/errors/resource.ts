import { CostateError } from './base.js';

export class FileNotFoundError extends CostateError {
  readonly code = 'FILE_NOT_FOUND' as const;
  readonly statusCode = 404;

  constructor(file: string) {
    super(`File not found: ${file}`);
  }
}

/** @deprecated Use FileNotFoundError instead */
export const ResourceNotFoundError = FileNotFoundError;

export class PayloadTooLargeError extends CostateError {
  readonly code = 'FILE_PAYLOAD_TOO_LARGE' as const;
  readonly statusCode = 413;

  constructor(size: number, maxSize: number) {
    super(`Payload size ${size} exceeds limit of ${maxSize} bytes`);
  }
}

export class WorkspaceNotFoundError extends CostateError {
  readonly code = 'WORKSPACE_NOT_FOUND' as const;
  readonly statusCode = 404;

  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`);
  }
}

export class ValidationError extends CostateError {
  readonly code = 'FILE_VALIDATION_ERROR' as const;
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}
