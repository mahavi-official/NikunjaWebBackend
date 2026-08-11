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

export async function buildApp() {
  const fastify = Fastify({
    logger: createLogger(),
    requestIdLogLabel: "req.id",
    disableRequestLogging: false,
    requestTimeout: 30000,
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
    swagger: {
      info: {
        title: "Radhakundah Platform API",
        description: "REST API for the Radhakundah content hub",
        version: "1.0.0",
      },
      host: env.API_URL.replace(/https?:\/\//, "").split(":")[0],
      schemes: [env.API_URL.startsWith("https") ? "https" : "http"],
      consumes: ["application/json"],
      produces: ["application/json"],
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
  });

  fastify.get("/health", async (_request, reply) => {
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });

  fastify.get("/health/ready", async (request, reply) => {
    try {
      await request.server.prisma.$queryRaw`SELECT 1`;
      return reply.send({ status: "ready", timestamp: new Date().toISOString() });
    } catch (error) {
      return reply.status(503).send({ status: "not ready", error: "Database connection failed" });
    }
  });

  fastify.get(`${API_PREFIX}/`, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        name: "Radhakundah Platform API",
        version: "1.0.0",
        environment: env.NODE_ENV,
      },
    });
  });

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
