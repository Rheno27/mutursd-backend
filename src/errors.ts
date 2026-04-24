export interface AppErrorOptions {
  statusCode?: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown;
  public readonly cause?: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code;
    this.details = options.details;
    this.cause = options.cause;
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, {
      statusCode: 400,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, {
      statusCode: 401,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, {
      statusCode: 403,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, {
      statusCode: 404,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, {
      statusCode: 409,
    });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error", details?: unknown) {
    super(message, {
      statusCode: 422,
      code: "VALIDATION_ERROR",
      details,
    });
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable entity", details?: unknown) {
    super(message, {
      statusCode: 422,
      code: "UNPROCESSABLE_ENTITY",
      details,
    });
  }
}
