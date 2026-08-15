import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { handleError, FieldError, ErrorCode } from "@/lib/errors";
import { HTTP_STATUS } from "@/config/constants";

/** Turns an ajv error entry into the `{ field, message }` shape clients expect. */
function toFieldError(issue: { instancePath?: string; params?: Record<string, unknown>; message?: string }): FieldError {
  const missing = issue.params?.missingProperty as string | undefined;
  const path = issue.instancePath?.replace(/^\//, "").replace(/\//g, ".");

  return {
    field: path || missing || "unknown",
    message: issue.message || "Invalid value",
  };
}

/** Framework errors (rate limit, unparsable body, …) carry a status but not our code. */
const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HTTP_STATUS.BAD_REQUEST]: "VALIDATION_FAILED",
  [HTTP_STATUS.UNAUTHORIZED]: "UNAUTHORIZED",
  [HTTP_STATUS.FORBIDDEN]: "FORBIDDEN",
  [HTTP_STATUS.NOT_FOUND]: "NOT_FOUND",
  [HTTP_STATUS.CONFLICT]: "CONFLICT",
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: "VALIDATION_FAILED",
  [HTTP_STATUS.TOO_MANY_REQUESTS]: "RATE_LIMITED",
};

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error, request, reply) => {
    // Route schema validation (params, query string, body).
    if (error.validation) {
      await reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Validation failed",
          details: error.validation.map(toFieldError),
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      const details: FieldError[] = error.errors.map((err) => ({
        field: err.path.join(".") || "unknown",
        message: err.message,
      }));

      await reply.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).send({
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Validation failed",
          details,
        },
      });
      return;
    }

    if ("code" in error && error.code === "P2002") {
      await reply.status(HTTP_STATUS.CONFLICT).send({
        success: false,
        error: {
          code: "CONFLICT",
          message: "Unique constraint violation",
        },
      });
      return;
    }

    if ("code" in error && error.code === "P2025") {
      await reply.status(HTTP_STATUS.NOT_FOUND).send({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Resource not found",
        },
      });
      return;
    }

    // Errors raised by Fastify or its plugins — most importantly the rate
    // limiter, which would otherwise be reported as a 500.
    const statusCode = error.statusCode;
    if (statusCode && STATUS_TO_CODE[statusCode]) {
      await reply.status(statusCode).send({
        success: false,
        error: {
          code: STATUS_TO_CODE[statusCode],
          message: error.message,
        },
      });
      return;
    }

    await handleError(error, request, reply);
  });
}

export default fp(errorHandlerPlugin);
