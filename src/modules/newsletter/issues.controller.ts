import { FastifyReply, FastifyRequest } from "fastify";
import { createAuditLog } from "@/lib/audit";
import { paginationMeta, successResponse } from "@/lib/response";
import { buildBreadcrumbJsonLd, buildSeo } from "@/lib/seo";
import { stripHtmlTags, truncateText } from "@/lib/sanitize";
import issuesService from "./issues.service";
import { createIssueSchema, listIssuesSchema, testSendSchema, updateIssueSchema } from "./issues.schema";

export const issuesController = {
  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const query = listIssuesSchema.parse(request.query);
    const { issues, total } = await issuesService.list(request.server.prisma, query, true);
    return reply.send(successResponse({ issues }, paginationMeta(query.page, query.limit, total)));
  },

  async getPublic(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const { issue, newer, older } = await issuesService.getPublicBySlug(request.server.prisma, slug);

    const path = `/newsletter/${issue.slug}`;
    const seo = buildSeo(
      issue.metaTitle || issue.title,
      issue.metaDescription || issue.subtitle || issue.excerpt || truncateText(stripHtmlTags(issue.content), 155),
      path,
      issue.coverImage?.url,
      issue.noIndex,
      "article",
      issue.publishedAt?.toISOString(),
      issue.updatedAt.toISOString(),
      issue.author.name
    );
    const home = seo.canonical.split("/").slice(0, 3).join("/");
    seo.jsonLd = [
      buildBreadcrumbJsonLd([
        { name: "Home", url: home },
        { name: "Newsletter", url: `${home}/newsletter` },
        { name: issue.title, url: seo.canonical },
      ]),
    ];

    return reply.send(successResponse({ issue, newer, older, seo }));
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listIssuesSchema.parse(request.query);
    const { issues, total } = await issuesService.list(request.server.prisma, query, false);
    return reply.send(successResponse({ issues }, paginationMeta(query.page, query.limit, total)));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    return reply.send(successResponse(await issuesService.get(request.server.prisma, id)));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = createIssueSchema.parse(request.body);
    const issue = await issuesService.create(request.server.prisma, data, request.user!.id);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.create", "newsletterIssue", issue.id);
    return reply.status(201).send(successResponse(issue));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const data = updateIssueSchema.parse(request.body);
    const issue = await issuesService.update(request.server.prisma, id, data);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.update", "newsletterIssue", id);
    return reply.send(successResponse(issue));
  },

  async publish(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const issue = await issuesService.publish(request.server.prisma, id);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.publish", "newsletterIssue", id);
    return reply.send(successResponse(issue));
  },

  async unpublish(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const issue = await issuesService.unpublish(request.server.prisma, id);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.unpublish", "newsletterIssue", id);
    return reply.send(successResponse(issue));
  },

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    await issuesService.remove(request.server.prisma, id);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.delete", "newsletterIssue", id);
    return reply.send(successResponse({ message: "Issue deleted" }));
  },

  async testSend(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { email } = testSendSchema.parse(request.body ?? {});
    let to = email;
    if (!to) {
      const me = await request.server.prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { email: true },
      });
      to = me!.email;
    }
    await issuesService.sendTest(request.server.prisma, id, to);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.test_send", "newsletterIssue", id, { to });
    return reply.send(successResponse({ message: `Test email sent to ${to}` }));
  },

  async send(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const issue = await issuesService.startSend(request.server.prisma, id);
    await createAuditLog(request.server.prisma, request, "newsletter.issue.send", "newsletterIssue", id, {
      recipients: issue.recipientCount,
    });
    return reply.status(202).send(successResponse(issue));
  },
};
