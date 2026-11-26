import { Prisma, PrismaClient } from "@prisma/client";
import slugify from "slugify";
import { env } from "@/config/env";
import { API_PREFIX } from "@/config/constants";
import { ConflictError, NotFoundError, ValidationFailedError } from "@/lib/errors";
import { sendEmail, EmailOptions } from "@/lib/mailer";
import { sanitizeRichText, stripHtmlTags, truncateText } from "@/lib/sanitize";
import { renderIssueEmail } from "./issues.email";
import { CreateIssueInput, ListIssuesQuery, UpdateIssueInput } from "./issues.schema";

const ISSUE_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  coverImage: true,
} satisfies Prisma.NewsletterIssueInclude;

export type IssueWithRelations = Prisma.NewsletterIssueGetPayload<{ include: typeof ISSUE_INCLUDE }>;

/** Subscribers fetched per query while sending. */
const SEND_BATCH = 50;

/**
 * Stop a run after this many failures in a row with no success in between.
 * That pattern is a broken SMTP account, not bad addresses, and carrying on
 * would just log the same error for every subscriber.
 */
const MAX_CONSECUTIVE_FAILURES = 5;

export interface SendDeps {
  send: (options: EmailOptions) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  delayMs: number;
  log: (message: string, error?: unknown) => void;
}

const defaultDeps: SendDeps = {
  send: sendEmail,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  delayMs: env.NEWSLETTER_SEND_DELAY_MS,
  log: (message, error) => (error ? console.error(`[newsletter] ${message}`, error) : console.log(`[newsletter] ${message}`)),
};

function isLive(issue: { status: string; publishedAt: Date | null }): boolean {
  return issue.status === "PUBLISHED" && !!issue.publishedAt && issue.publishedAt <= new Date();
}

function stripContent<T extends { content: string }>(issue: T): Omit<T, "content"> {
  const { content: _content, ...rest } = issue;
  return rest;
}

async function siteName(prisma: PrismaClient): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key: "site.title" } });
  return typeof setting?.value === "string" && setting.value ? setting.value : "Radhakundah";
}

function siteUrl(): string {
  return env.SITE_URL.replace(/\/$/, "");
}

class NewsletterIssuesService {
  // ───────────────────────────── authoring ─────────────────────────────

  private async uniqueSlug(prisma: PrismaClient, source: string, excludeId?: string): Promise<string> {
    const base = slugify(source, { lower: true, strict: true }) || "issue";
    let slug = base;
    for (let n = 1; ; n++) {
      const clash = await prisma.newsletterIssue.findUnique({ where: { slug }, select: { id: true } });
      if (!clash || clash.id === excludeId) return slug;
      slug = `${base}-${n}`;
    }
  }

  async create(prisma: PrismaClient, data: CreateIssueInput, authorId: string): Promise<IssueWithRelations> {
    const content = sanitizeRichText(data.content);
    const slug = await this.uniqueSlug(prisma, data.slug || data.title);

    return prisma.newsletterIssue.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        slug,
        excerpt: data.excerpt || truncateText(stripHtmlTags(content), 200),
        content,
        coverImageId: data.coverImageId || null,
        authorId,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        status: data.publishedAt ? "PUBLISHED" : "DRAFT",
        metaTitle: data.metaTitle || null,
        metaDescription: data.metaDescription || null,
        noIndex: data.noIndex,
      },
      include: ISSUE_INCLUDE,
    });
  }

  async get(prisma: PrismaClient, id: string): Promise<IssueWithRelations> {
    const issue = await prisma.newsletterIssue.findUnique({ where: { id }, include: ISSUE_INCLUDE });
    if (!issue) throw new NotFoundError("Newsletter issue not found");
    return issue;
  }

  async getPublicBySlug(prisma: PrismaClient, slug: string) {
    const issue = await prisma.newsletterIssue.findUnique({ where: { slug }, include: ISSUE_INCLUDE });
    if (!issue || !isLive(issue)) throw new NotFoundError("Newsletter issue not found");

    // The neighbours give the issue page its "previous / next" links.
    const [newer, older] = await Promise.all([
      prisma.newsletterIssue.findFirst({
        where: { status: "PUBLISHED", publishedAt: { gt: issue.publishedAt!, lte: new Date() } },
        orderBy: { publishedAt: "asc" },
        select: { title: true, slug: true, publishedAt: true },
      }),
      prisma.newsletterIssue.findFirst({
        where: { status: "PUBLISHED", publishedAt: { lt: issue.publishedAt! } },
        orderBy: { publishedAt: "desc" },
        select: { title: true, slug: true, publishedAt: true },
      }),
    ]);

    return { issue, newer, older };
  }

  async list(prisma: PrismaClient, query: ListIssuesQuery, publishedOnly: boolean) {
    const where: Prisma.NewsletterIssueWhereInput = {};

    if (publishedOnly) {
      where.status = "PUBLISHED";
      where.publishedAt = { lte: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { subtitle: { contains: query.q, mode: "insensitive" } },
        { excerpt: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [issues, total] = await Promise.all([
      prisma.newsletterIssue.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        // Drafts have no publishedAt; keep them at the top of the admin list.
        orderBy: publishedOnly
          ? { publishedAt: "desc" }
          : [{ publishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        include: ISSUE_INCLUDE,
      }),
      prisma.newsletterIssue.count({ where }),
    ]);

    return { issues: issues.map(stripContent), total };
  }

  async update(prisma: PrismaClient, id: string, data: UpdateIssueInput): Promise<IssueWithRelations> {
    const existing = await this.get(prisma, id);
    if (existing.sendStatus === "SENDING") {
      throw new ConflictError("This issue is being emailed right now. Edit it once the send finishes.");
    }

    let slug: string | undefined;
    if (data.slug !== undefined && data.slug !== existing.slug) {
      slug = await this.uniqueSlug(prisma, data.slug || existing.title, id);
      // An issue that was already published or mailed has links out in the
      // world; keep them working.
      if (existing.status === "PUBLISHED" || existing.sendStatus !== "NOT_SENT") {
        await prisma.urlRedirect.upsert({
          where: { fromPath: `/newsletter/${existing.slug}` },
          update: { toPath: `/newsletter/${slug}` },
          create: { fromPath: `/newsletter/${existing.slug}`, toPath: `/newsletter/${slug}`, statusCode: 301, isAuto: true },
        });
      }
    }

    const updateData: Prisma.NewsletterIssueUpdateInput = {
      ...(data.title !== undefined && { title: data.title }),
      ...(slug !== undefined && { slug }),
      ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
      ...(data.excerpt !== undefined && { excerpt: data.excerpt || null }),
      ...(data.content !== undefined && { content: sanitizeRichText(data.content) }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        status: data.publishedAt ? "PUBLISHED" : "DRAFT",
      }),
      ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle || null }),
      ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription || null }),
      ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      ...(data.coverImageId !== undefined && {
        coverImage: data.coverImageId ? { connect: { id: data.coverImageId } } : { disconnect: true },
      }),
    };

    return prisma.newsletterIssue.update({ where: { id }, data: updateData, include: ISSUE_INCLUDE });
  }

  async publish(prisma: PrismaClient, id: string): Promise<IssueWithRelations> {
    const existing = await this.get(prisma, id);
    return prisma.newsletterIssue.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: existing.publishedAt ?? new Date() },
      include: ISSUE_INCLUDE,
    });
  }

  async unpublish(prisma: PrismaClient, id: string): Promise<IssueWithRelations> {
    const existing = await this.get(prisma, id);
    if (existing.sendStatus === "SENDING") {
      throw new ConflictError("This issue is being emailed right now.");
    }
    return prisma.newsletterIssue.update({ where: { id }, data: { status: "DRAFT" }, include: ISSUE_INCLUDE });
  }

  async remove(prisma: PrismaClient, id: string): Promise<void> {
    const existing = await this.get(prisma, id);
    if (existing.sendStatus === "SENDING") {
      throw new ConflictError("This issue is being emailed right now. Delete it once the send finishes.");
    }
    await prisma.newsletterIssue.delete({ where: { id } });
  }

  // ───────────────────────────── sending ─────────────────────────────

  /** One copy to one address, marked [Test], with no unsubscribe link. Records nothing. */
  async sendTest(prisma: PrismaClient, id: string, to: string, deps: SendDeps = defaultDeps): Promise<void> {
    const issue = await this.get(prisma, id);
    const email = renderIssueEmail(
      { ...issue, coverImageUrl: issue.coverImage?.url, authorName: issue.author.name, publishedAt: issue.publishedAt ?? new Date() },
      { siteName: await siteName(prisma), siteUrl: siteUrl(), subjectPrefix: "[Test]" }
    );
    await deps.send({ to, subject: email.subject, html: email.html, text: email.text });
  }

  /**
   * Claims the issue for sending and starts the run in the background. Returns
   * as soon as the claim is made; the admin UI polls the issue for progress.
   *
   * Sending publishes the issue on the site first, the way Substack's "Publish
   * and send" does, because every email links back to its web page.
   */
  async startSend(prisma: PrismaClient, id: string, deps: SendDeps = defaultDeps): Promise<IssueWithRelations> {
    const issue = await this.get(prisma, id);

    const recipients = await prisma.subscriber.count({ where: { isActive: true } });
    if (recipients === 0) {
      throw new ValidationFailedError("There are no active subscribers to send to yet.");
    }

    // The conditional update is the lock: two admins pressing Send at once
    // cannot both get a row back.
    const claimed = await prisma.newsletterIssue.updateMany({
      where: {
        id,
        OR: [{ sendStatus: { in: ["NOT_SENT", "FAILED"] } }, { sendStatus: "SENT", failedCount: { gt: 0 } }],
      },
      data: {
        sendStatus: "SENDING",
        sendStartedAt: new Date(),
        recipientCount: recipients,
        ...(!isLive(issue) && { status: "PUBLISHED", publishedAt: new Date() }),
      },
    });

    if (claimed.count === 0) {
      throw new ConflictError(
        issue.sendStatus === "SENDING" ? "This issue is already being sent." : "This issue has already been sent to every subscriber."
      );
    }

    void this.runSend(prisma, id, deps).catch((error) => deps.log(`send run for ${id} crashed`, error));

    return this.get(prisma, id);
  }

  /**
   * Emails every active subscriber who does not yet have a successful delivery
   * of this issue. Safe to call again after a crash or partial failure.
   */
  async runSend(prisma: PrismaClient, id: string, deps: SendDeps = defaultDeps): Promise<void> {
    const issue = await this.get(prisma, id);
    const name = await siteName(prisma);
    const base = siteUrl();
    const apiBase = `${env.API_URL.replace(/\/$/, "")}${API_PREFIX}`;

    let cursor: string | undefined;
    let consecutiveFailures = 0;
    let aborted = false;

    try {
      batches: while (true) {
        const batch = await prisma.subscriber.findMany({
          // Keyset on id rather than Prisma's `cursor`: a delivered subscriber
          // drops out of this filter, and `cursor` + `skip: 1` would then skip
          // the next real recipient instead of the one already sent to.
          where: {
            isActive: true,
            deliveries: { none: { issueId: id, status: "SENT" } },
            ...(cursor && { id: { gt: cursor } }),
          },
          orderBy: { id: "asc" },
          take: SEND_BATCH,
          select: { id: true, email: true, unsubscribeToken: true },
        });
        if (batch.length === 0) break;
        cursor = batch[batch.length - 1].id;

        for (const subscriber of batch) {
          const token = encodeURIComponent(subscriber.unsubscribeToken);
          const email = renderIssueEmail(
            { ...issue, coverImageUrl: issue.coverImage?.url, authorName: issue.author.name },
            {
              siteName: name,
              siteUrl: base,
              unsubscribeUrl: `${base}/newsletter/unsubscribe/${token}`,
              oneClickUnsubscribeUrl: `${apiBase}/public/newsletter/unsubscribe/${token}`,
            }
          );

          let error: string | null = null;
          try {
            await deps.send({ to: subscriber.email, subject: email.subject, html: email.html, text: email.text, headers: email.headers });
            consecutiveFailures = 0;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            consecutiveFailures++;
          }

          await prisma.newsletterDelivery.upsert({
            where: { issueId_subscriberId: { issueId: id, subscriberId: subscriber.id } },
            update: { status: error ? "FAILED" : "SENT", error },
            create: { issueId: id, subscriberId: subscriber.id, status: error ? "FAILED" : "SENT", error },
          });

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            deps.log(`stopping send of ${id}: ${consecutiveFailures} failures in a row (last: ${error})`);
            aborted = true;
            break batches;
          }

          if (deps.delayMs > 0) await deps.sleep(deps.delayMs);
        }

        await this.refreshCounts(prisma, id);
      }
    } catch (err) {
      aborted = true;
      deps.log(`send of ${id} stopped by an error`, err);
    }

    const { sent } = await this.refreshCounts(prisma, id);
    await prisma.newsletterIssue.update({
      where: { id },
      data: aborted || sent === 0 ? { sendStatus: "FAILED" } : { sendStatus: "SENT", sentAt: new Date() },
    });
  }

  private async refreshCounts(prisma: PrismaClient, id: string) {
    const [sent, failed] = await Promise.all([
      prisma.newsletterDelivery.count({ where: { issueId: id, status: "SENT" } }),
      prisma.newsletterDelivery.count({ where: { issueId: id, status: "FAILED" } }),
    ]);
    await prisma.newsletterIssue.update({ where: { id }, data: { sentCount: sent, failedCount: failed } });
    return { sent, failed };
  }

  /**
   * A run lives in process memory, so a restart mid-send leaves the issue
   * stuck in SENDING. Called once at boot: mark those FAILED so an admin can
   * resume, which skips everyone already delivered to.
   */
  async recoverInterruptedSends(prisma: PrismaClient): Promise<number> {
    const { count } = await prisma.newsletterIssue.updateMany({
      where: { sendStatus: "SENDING" },
      data: { sendStatus: "FAILED" },
    });
    return count;
  }
}

export default new NewsletterIssuesService();
