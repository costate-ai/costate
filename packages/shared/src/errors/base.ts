export abstract class CostateError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.code,
      message: this.message,
    };
  }
}
