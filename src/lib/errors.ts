import { FastifyReply, FastifyRequest } from "fastify";
import { HTTP_STATUS } from "@/config/constants";

export type ErrorCode =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  statusCode: number = HTTP_STATUS.INTERNAL_ERROR;
  code: ErrorCode = "INTERNAL_ERROR";
  details?: FieldError[];

  constructor(message: string, statusCode?: number, code?: ErrorCode, details?: FieldError[]) {
    super(message);
    this.name = "AppError";
    if (statusCode) this.statusCode = statusCode;
    if (code) this.code = code;
    if (details) this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found", details?: FieldError[]) {
    super(message, HTTP_STATUS.NOT_FOUND, "NOT_FOUND", details);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", details?: FieldError[]) {
    super(message, HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED", details);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", details?: FieldError[]) {
    super(message, HTTP_STATUS.FORBIDDEN, "FORBIDDEN", details);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict", details?: FieldError[]) {
    super(message, HTTP_STATUS.CONFLICT, "CONFLICT", details);
    this.name = "ConflictError";
  }
}

export class ValidationFailedError extends AppError {
  constructor(message: string = "Validation failed", details?: FieldError[]) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", details);
    this.name = "ValidationFailedError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests", details?: FieldError[]) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, "RATE_LIMITED", details);
    this.name = "RateLimitError";
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
  };
}

export async function handleError(
  error: unknown,
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";

  if (error instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    };
    await reply.status(error.statusCode).send(response);
    return;
  }

  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid JSON",
      },
    };
    await reply.status(HTTP_STATUS.BAD_REQUEST).send(response);
    return;
  }

  const correlationId = _request.id;
  console.error(`[${correlationId}] Unhandled error:`, error);

  const response: ErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error",
    },
  };

  await reply.status(HTTP_STATUS.INTERNAL_ERROR).send(response);
}
