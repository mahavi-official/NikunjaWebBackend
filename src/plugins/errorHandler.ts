import { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { handleError, AppError, FieldError } from "@/lib/errors";
import { HTTP_STATUS } from "@/config/constants";

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(async (error, request, reply) => {
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

    await handleError(error, request, reply);
  });
}

export default fp(errorHandlerPlugin);
