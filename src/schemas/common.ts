/**
 * Shared OpenAPI fragments used by every route definition.
 *
 * The API only ever answers with two envelopes:
 *   success -> { "success": true, "data": ..., "meta"?: { page, limit, total, totalPages } }
 *   failure -> { "success": false, "error": { "code", "message", "details"? } }
 *
 * The builders below produce those envelopes so each route file only has to
 * describe its own payload. Object schemas keep `additionalProperties: true`
 * on purpose — Fastify serialises responses from these schemas, and an open
 * object means an undocumented field is still returned instead of being
 * silently dropped.
 */

export type JsonSchema = Record<string, any>;

/** Sample cuid, used as the example value for every id/param field. */
export const ID_EXAMPLE = "clw8x2k4h0000v8p2q1r3s4t5";

// ───────────────────────────── field builders ─────────────────────────────

export function str(description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "string", description, ...extra };
}

export function nullableStr(description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "string", nullable: true, description, ...extra };
}

export function int(description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "integer", description, ...extra };
}

export function nullableInt(description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "integer", nullable: true, description, ...extra };
}

export function bool(description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "boolean", description, ...extra };
}

export function dateTime(description: string): JsonSchema {
  return {
    type: "string",
    format: "date-time",
    description,
    example: "2026-01-31T09:15:00.000Z",
  };
}

export function nullableDateTime(description: string): JsonSchema {
  return { ...dateTime(description), nullable: true };
}

/** Free-form JSON (Prisma `Json` columns). Returned exactly as stored. */
export function anyJson(description: string): JsonSchema {
  return { description };
}

export function id(entity: string): JsonSchema {
  return str(`Unique ${entity} id (cuid).`, { example: ID_EXAMPLE });
}

export function slug(entity: string): JsonSchema {
  return str(`URL-safe ${entity} slug.`, { example: "radha-kunda-history" });
}

export function enumOf(values: string[], description: string, extra: JsonSchema = {}): JsonSchema {
  return { type: "string", enum: values, description, example: values[0], ...extra };
}

export function arrayOf(items: JsonSchema, description: string): JsonSchema {
  return { type: "array", items, description };
}

/** An object whose extra keys survive serialisation. */
export function obj(description: string, properties: JsonSchema): JsonSchema {
  return { type: "object", description, additionalProperties: true, properties };
}

// ───────────────────────────── request builders ─────────────────────────────

/** Path parameters. Every declared key is required — that is how routing works. */
export function pathParams(properties: JsonSchema): JsonSchema {
  return {
    type: "object",
    required: Object.keys(properties),
    properties,
  };
}

/** Query string. Unknown keys are accepted and ignored. */
export function queryParams(properties: JsonSchema, required: string[] = []): JsonSchema {
  return {
    type: "object",
    additionalProperties: true,
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

/** JSON request body. */
export function jsonBody(
  description: string,
  properties: JsonSchema,
  required: string[] = []
): JsonSchema {
  return {
    type: "object",
    description,
    additionalProperties: true,
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

/**
 * Same fields, minus every `default`.
 *
 * Create and update endpoints share one field map, but ajv fills defaults in
 * before the handler runs. On a PATCH that would turn "field omitted" into
 * "field reset", so update bodies always use the stripped variant.
 */
export function withoutDefaults(fields: JsonSchema): JsonSchema {
  return Object.fromEntries(
    Object.entries(fields).map(([key, schema]) => {
      const { default: _default, ...rest } = schema as JsonSchema;
      return [key, rest];
    })
  );
}

/** `?id=…` style path param for the most common case. */
export const idParam = (entity: string): JsonSchema => pathParams({ id: id(entity) });

export const slugParam = (entity: string): JsonSchema => pathParams({ slug: slug(entity) });

/** Standard `page` / `limit` query pair. */
export function pageQuery(defaultLimit = 20, maxLimit = 100): JsonSchema {
  return {
    page: int("1-based page number.", { minimum: 1, default: 1, example: 1 }),
    limit: int(`Items per page (max ${maxLimit}).`, {
      minimum: 1,
      maximum: maxLimit,
      default: defaultLimit,
      example: defaultLimit,
    }),
  };
}

// ───────────────────────────── response builders ─────────────────────────────

const successFlag = bool("Always `true` on a 2xx response.", { example: true });

/** `{ success: true, data: <payload> }` */
export function ok(description: string, data: JsonSchema): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: true,
    properties: { success: successFlag, data },
  };
}

/** `{ success: true, data: { <key>: <payload> } }` */
export function okWrapped(description: string, key: string, payload: JsonSchema): JsonSchema {
  return ok(description, {
    type: "object",
    additionalProperties: true,
    properties: { [key]: payload },
  });
}

export const paginationMetaSchema: JsonSchema = obj("Pagination counters for this result set.", {
  page: int("Page that was returned.", { example: 1 }),
  limit: int("Items per page that was applied.", { example: 20 }),
  total: int("Total number of matching rows, ignoring pagination.", { example: 137 }),
  totalPages: int("`ceil(total / limit)`.", { example: 7 }),
});

/** `{ success: true, data: { <key>: [...] }, meta: {...} }` */
export function okPaged(
  description: string,
  key: string,
  item: JsonSchema,
  itemsDescription: string
): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: true,
    properties: {
      success: successFlag,
      data: {
        type: "object",
        additionalProperties: true,
        properties: { [key]: arrayOf(item, itemsDescription) },
      },
      meta: paginationMetaSchema,
    },
  };
}

/** `{ success: true, data: { message: "…" } }` — used by every delete/ack route. */
export function okMessage(description: string, example: string): JsonSchema {
  return ok(
    description,
    obj("Acknowledgement payload.", {
      message: str("Human-readable confirmation.", { example }),
    })
  );
}

/**
 * A response with no body — redirects, mostly.
 *
 * The `type` is not decoration: Fastify reads a response schema that has no
 * type as the deprecated "json shorthand" and turns every key into a
 * property, which fails to compile.
 */
export function emptyBody(description: string): JsonSchema {
  return { description, type: "string", example: "" };
}

/** A plain text/CSV/XML body. Fastify never re-serialises string payloads. */
export function rawBody(description: string, example?: string): JsonSchema {
  return { description, type: "string", ...(example ? { example } : {}) };
}

// ───────────────────────────── error responses ─────────────────────────────

export const ERROR_CODES = [
  "NOT_FOUND",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "CONFLICT",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

const fieldErrorSchema = obj("One field that failed validation.", {
  field: str("Dotted path of the offending field.", { example: "email" }),
  message: str("Why the field was rejected.", { example: "Invalid email" }),
});

export function errorEnvelope(description: string, code: string, message: string): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: true,
    properties: {
      success: bool("Always `false` on an error response.", { example: false }),
      error: obj("Error detail.", {
        code: enumOf([...ERROR_CODES], "Stable machine-readable error code.", { example: code }),
        message: str("Human-readable explanation.", { example: message }),
        details: arrayOf(fieldErrorSchema, "Per-field problems. Only present on validation errors."),
      }),
    },
  };
}

/**
 * The `{ "error": "…" }` shape a few pre-envelope endpoints still return
 * (Google OAuth callback, refresh/logout, file uploads).
 */
export function plainError(description: string, example: string): JsonSchema {
  return {
    description,
    type: "object",
    additionalProperties: true,
    properties: { error: str("Failure reason.", { example }) },
  };
}

const ERROR_LIBRARY: Record<number, JsonSchema> = {
  400: errorEnvelope("Malformed request — unparsable JSON or a missing file part.", "VALIDATION_FAILED", "Invalid JSON"),
  401: errorEnvelope("Missing, malformed, or expired access token.", "UNAUTHORIZED", "Missing authorization token"),
  403: errorEnvelope("Authenticated, but the role or module permission is insufficient.", "FORBIDDEN", "Insufficient permissions"),
  404: errorEnvelope("No record matches the given id/slug/key.", "NOT_FOUND", "Resource not found"),
  409: errorEnvelope("Unique constraint violation — e.g. the slug or email is taken.", "CONFLICT", "Unique constraint violation"),
  422: errorEnvelope("Request body or query string failed validation. `error.details` lists every offending field.", "VALIDATION_FAILED", "Validation failed"),
  429: errorEnvelope("Rate limit exceeded. Retry after the window in the `retry-after` header.", "RATE_LIMITED", "Too many requests"),
  500: errorEnvelope("Unexpected server error. The message is generic in production.", "INTERNAL_ERROR", "Internal server error"),
};

export function errorResponses(...statuses: number[]): Record<string, JsonSchema> {
  const out: Record<string, JsonSchema> = {};
  for (const status of statuses) {
    out[String(status)] = ERROR_LIBRARY[status];
  }
  return out;
}

// ───────────────────────────── operation builder ─────────────────────────────

export interface OperationInput {
  tags: string[];
  /** One line shown in the collapsed operation row. */
  summary: string;
  /** What the endpoint does, plus anything a caller needs to know. Markdown. */
  description: string;
  /** Who may call it, e.g. `"SUPER_ADMIN or ADMIN"`. Omit for public routes. */
  access?: string;
  params?: JsonSchema;
  query?: JsonSchema;
  body?: JsonSchema;
  consumes?: string[];
  produces?: string[];
  /** Success responses keyed by status code. Also overrides any auto error. */
  response: Record<string, JsonSchema>;
  /** Extra error statuses to document on top of the automatic ones. */
  errors?: number[];
}

/**
 * Assembles a complete Fastify route schema: tags, prose, bearer security,
 * request shapes, and the error responses that this route can actually
 * produce (auth errors only when it is guarded, 404 only when it takes a
 * path param, and so on).
 */
export function op(input: OperationInput): JsonSchema {
  const auto: number[] = [429, 500];

  if (input.access) auto.unshift(401, 403);
  if (input.params) auto.unshift(404);
  if (input.body || input.query) auto.unshift(422);
  if (input.errors) auto.unshift(...input.errors);

  const accessLine = input.access
    ? `**Access:** requires a Bearer access token — ${input.access}.`
    : "**Access:** public, no token required.";

  return {
    tags: input.tags,
    summary: input.summary,
    description: `${input.description}\n\n${accessLine}`,
    ...(input.access ? { security: [{ bearerAuth: [] }] } : {}),
    ...(input.params ? { params: input.params } : {}),
    ...(input.query ? { querystring: input.query } : {}),
    ...(input.body ? { body: input.body } : {}),
    ...(input.consumes ? { consumes: input.consumes } : {}),
    ...(input.produces ? { produces: input.produces } : {}),
    response: {
      ...errorResponses(...new Set(auto)),
      ...input.response,
    },
  };
}
