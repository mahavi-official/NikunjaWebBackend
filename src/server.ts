import Fastify from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import corsPlugin from "@/plugins/cors";
import helmetPlugin from "@/plugins/helmet";
import rateLimitPlugin from "@/plugins/rateLimit";
import errorHandlerPlugin from "@/plugins/errorHandler";
import prismaPlugin from "@/plugins/prisma";
import loggerPlugin, { createLogger } from "@/plugins/logger";
import authPlugin from "@/plugins/auth";
import rbacPlugin from "@/plugins/rbac";
import { registerAuthRoutes } from "@/modules/auth/auth.routes";
import { registerUsersRoutes } from "@/modules/users/users.routes";
import { registerMediaRoutes } from "@/modules/media/media.routes";
import { registerCategoriesRoutes } from "@/modules/categories/categories.routes";
import { registerTagsRoutes } from "@/modules/tags/tags.routes";
import { registerPostsRoutes } from "@/modules/posts/posts.routes";
import { registerAuthorsRoutes } from "@/modules/authors/authors.routes";
import { registerResearchRoutes } from "@/modules/research/research.routes";
import { registerGalleryRoutes } from "@/modules/gallery/gallery.routes";
import { registerVideosRoutes } from "@/modules/videos/videos.routes";
import { registerEngagementRoutes } from "@/modules/engagement/engagement.routes";
import { registerPagesRoutes } from "@/modules/pages/pages.routes";
import { registerHeroRoutes } from "@/modules/hero/hero.routes";
import { registerSettingsRoutes } from "@/modules/settings/settings.routes";
import { registerContactRoutes } from "@/modules/contact/contact.routes";
import { registerNewsletterRoutes } from "@/modules/newsletter/newsletter.routes";
import { registerSearchRoutes } from "@/modules/search/search.routes";
import { registerSeoRoutes, registerSitemapRoutes } from "@/modules/seo/seo.routes";
import { registerDashboardRoutes } from "@/modules/dashboard/dashboard.routes";
import { registerHomeRoutes } from "@/modules/home/home.routes";
import { registerMeRoutes } from "@/modules/users/me.routes";
import { env } from "@/config/env";
import { API_PREFIX } from "@/config/constants";
import { dateTime, obj, ok, op, str } from "@/schemas/common";

const API_DESCRIPTION = `
REST API for the Radhakundah content hub.

### Response envelope

Every JSON endpoint answers with one of two shapes.

\`\`\`jsonc
// success
{ "success": true, "data": { /* payload */ }, "meta": { /* only on list endpoints */ } }

// failure
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Post not found", "details": [] } }
\`\`\`

\`error.code\` is one of \`VALIDATION_FAILED\`, \`UNAUTHORIZED\`, \`FORBIDDEN\`, \`NOT_FOUND\`,
\`CONFLICT\`, \`RATE_LIMITED\`, \`INTERNAL_ERROR\`. \`details\` is only present on validation
failures and lists every offending field.

### Route families

| Prefix | Who can call it |
| --- | --- |
| \`/api/v1/public/*\` | Anyone. No token. Only published content. |
| \`/api/v1/auth/*\` | Anyone. Sign-in and session lifecycle. |
| \`/api/v1/me/*\` | Any signed-in user. Acts on your own account. |
| \`/api/v1/admin/*\` | Staff. Each route lists the role or editor module it needs. |

### Authentication

Sign-in is Google OAuth only — there are no passwords. Send the browser to
\`GET /api/v1/auth/google\`; after consent the API sets an httpOnly \`refreshToken\` cookie and
redirects to \`{SITE_URL}/auth/callback?token=<accessToken>\`. Send that token on every
guarded call as \`Authorization: Bearer <token>\`. It lasts 15 minutes — call
\`POST /api/v1/auth/refresh\` (cookie-authenticated) for a new one.

Use the **Authorize** button above to try guarded endpoints from this page.

### Pagination

List endpoints take \`page\` (1-based) and \`limit\`, and return counters in \`meta\`:
\`{ page, limit, total, totalPages }\`.

### Rate limits

100 requests/minute per IP globally. Contact and newsletter submissions allow 3/hour,
search allows 30/minute. Exceeding a limit returns \`429\` with code \`RATE_LIMITED\`.
`.trim();

export async function buildApp() {
  const fastify = Fastify({
    logger: createLogger(),
    requestIdLogLabel: "req.id",
    disableRequestLogging: false,
    requestTimeout: 30000,
    ajv: {
      customOptions: {
        // `example` is an OpenAPI annotation, not a validation rule. Request
        // schemas carry it so Swagger UI can pre-fill "Try it out"; ajv runs
        // in strict mode and would otherwise reject the unknown keyword.
        keywords: ["example"],
      },
    },
  }).withTypeProvider<ZodTypeProvider>();

  await fastify.register(errorHandlerPlugin);
  await fastify.register(loggerPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(cookie);
  await fastify.register(multipart);
  await fastify.register(authPlugin);
  await fastify.register(rbacPlugin);
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Radhakundah Platform API",
        description: API_DESCRIPTION,
        version: "1.0.0",
      },
      servers: [
        { url: env.API_URL, description: `${env.NODE_ENV} server` },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description:
              "Paste the `accessToken` returned by `/api/v1/auth/refresh` (or the `token` query param the Google callback redirects with). Valid for 15 minutes.",
          },
        },
      },
      tags: [
        { name: "Auth", description: "Authentication and session management" },
        { name: "Users", description: "Admin user management" },
        { name: "Me", description: "Current user profile" },
        { name: "Media", description: "Media library uploads" },
        { name: "Categories", description: "Post categories" },
        { name: "Tags", description: "Post tags" },
        { name: "Posts", description: "Blog/article posts" },
        { name: "Authors", description: "Research authors" },
        { name: "Research", description: "Research publications" },
        { name: "Gallery", description: "Image gallery segments" },
        { name: "Videos", description: "Videos and video categories" },
        { name: "Engagement", description: "Likes and comments" },
        { name: "Pages", description: "Static content pages" },
        { name: "Hero", description: "Homepage hero slides" },
        { name: "Settings", description: "Site settings" },
        { name: "Contact", description: "Contact form messages" },
        { name: "Newsletter", description: "Newsletter subscriptions" },
        { name: "Search", description: "Site-wide search" },
        { name: "SEO", description: "Redirects and preview tokens" },
        { name: "Sitemap", description: "XML sitemaps" },
        { name: "Dashboard", description: "Admin dashboard stats and audit logs" },
        { name: "Home", description: "Homepage aggregate feed" },
        { name: "System", description: "Health checks and API metadata" },
      ],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      persistAuthorization: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: 0,
      defaultModelRendering: "example",
      tryItOutEnabled: true,
    },
  });

  fastify.get(
    "/health",
    {
      schema: op({
        tags: ["System"],
        summary: "Liveness probe",
        description:
          "Returns as soon as the process can serve traffic. Does not touch the database — use `/health/ready` for that.",
        response: {
          200: obj("The process is up.", {
            status: str("Always `ok`.", { example: "ok" }),
            timestamp: dateTime("Server time when the probe ran."),
          }),
        },
      }),
    },
    async (_request, reply) => {
      return reply.send({ status: "ok", timestamp: new Date().toISOString() });
    }
  );

  fastify.get(
    "/health/ready",
    {
      schema: op({
        tags: ["System"],
        summary: "Readiness probe",
        description:
          "Runs `SELECT 1` against Postgres. Answers 503 while the database is unreachable, so load balancers can drain the instance.",
        response: {
          200: obj("The database answered.", {
            status: str("Always `ready`.", { example: "ready" }),
            timestamp: dateTime("Server time when the probe ran."),
          }),
          503: obj("The database did not answer.", {
            status: str("Always `not ready`.", { example: "not ready" }),
            error: str("Failure reason.", { example: "Database connection failed" }),
          }),
        },
      }),
    },
    async (request, reply) => {
      try {
        await request.server.prisma.$queryRaw`SELECT 1`;
        return reply.send({ status: "ready", timestamp: new Date().toISOString() });
      } catch (error) {
        return reply.status(503).send({ status: "not ready", error: "Database connection failed" });
      }
    }
  );

  fastify.get(
    `${API_PREFIX}/`,
    {
      schema: op({
        tags: ["System"],
        summary: "API metadata",
        description: "Name, version, and deployment environment of this API instance.",
        response: {
          200: ok(
            "Metadata about the running API.",
            obj("API identity.", {
              name: str("API name.", { example: "Radhakundah Platform API" }),
              version: str("Semantic version of the deployed build.", { example: "1.0.0" }),
              environment: str("`development`, `production`, or `test`.", { example: "production" }),
            })
          ),
        },
      }),
    },
    async (_request, reply) => {
      return reply.send({
        success: true,
        data: {
          name: "Radhakundah Platform API",
          version: "1.0.0",
          environment: env.NODE_ENV,
        },
      });
    }
  );

  // Register module routes
  await fastify.register(async (fastify) => {
    await registerAuthRoutes(fastify);
    await registerUsersRoutes(fastify);
    await registerMediaRoutes(fastify);
    await registerCategoriesRoutes(fastify);
    await registerTagsRoutes(fastify);
    await registerPostsRoutes(fastify);
    await registerAuthorsRoutes(fastify);
    await registerResearchRoutes(fastify);
    await registerGalleryRoutes(fastify);
    await registerVideosRoutes(fastify);
    await registerEngagementRoutes(fastify);
    await registerPagesRoutes(fastify);
    await registerHeroRoutes(fastify);
    await registerSettingsRoutes(fastify);
    await registerContactRoutes(fastify);
    await registerNewsletterRoutes(fastify);
    await registerSearchRoutes(fastify);
    await registerSeoRoutes(fastify);
    await registerDashboardRoutes(fastify);
    await registerHomeRoutes(fastify);
    await registerMeRoutes(fastify);
  }, { prefix: API_PREFIX });

  await fastify.register(registerSitemapRoutes);

  return fastify;
}

export type FastifyZodInstance = Awaited<ReturnType<typeof buildApp>>;
