import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { env } from "@/config/env";
import { NotFoundError } from "@/lib/errors";

const PAGE_SIZE = 5000;

export type SitemapType =
  | "posts"
  | "research"
  | "gallery"
  | "videos"
  | "authors"
  | "categories"
  | "static";

interface SitemapEntry {
  loc: string;
  lastmod: string;
}

class SeoService {
  async getSitemapEntries(
    prisma: PrismaClient,
    type: SitemapType,
    page: number
  ): Promise<SitemapEntry[]> {
    const skip = (page - 1) * PAGE_SIZE;
    const publishedFilter = {
      status: "PUBLISHED" as const,
      publishedAt: { lte: new Date() },
      noIndex: false,
    };

    switch (type) {
      case "posts": {
        const posts = await prisma.post.findMany({
          where: publishedFilter,
          skip,
          take: PAGE_SIZE,
          select: { slug: true, placement: true, updatedAt: true },
        });
        return posts.map((p) => ({
          loc: `${env.SITE_URL}${p.placement === "BLOG" ? "/blogs" : "/articles"}/${p.slug}`,
          lastmod: p.updatedAt.toISOString(),
        }));
      }

      case "research": {
        const research = await prisma.research.findMany({
          where: publishedFilter,
          skip,
          take: PAGE_SIZE,
          select: { slug: true, updatedAt: true },
        });
        return research.map((r) => ({
          loc: `${env.SITE_URL}/research/${r.slug}`,
          lastmod: r.updatedAt.toISOString(),
        }));
      }

      case "videos": {
        const videos = await prisma.video.findMany({
          where: publishedFilter,
          skip,
          take: PAGE_SIZE,
          select: { slug: true, updatedAt: true },
        });
        return videos.map((v) => ({
          loc: `${env.SITE_URL}/videos/${v.slug}`,
          lastmod: v.updatedAt.toISOString(),
        }));
      }

      case "gallery": {
        const segments = await prisma.gallerySegment.findMany({
          where: { isPublished: true, noIndex: false },
          skip,
          take: PAGE_SIZE,
          select: { slug: true, updatedAt: true },
        });
        return segments.map((s) => ({
          loc: `${env.SITE_URL}/gallery/${s.slug}`,
          lastmod: s.updatedAt.toISOString(),
        }));
      }

      case "authors": {
        const authors = await prisma.author.findMany({
          where: { noIndex: false },
          skip,
          take: PAGE_SIZE,
          select: { slug: true, updatedAt: true },
        });
        return authors.map((a) => ({
          loc: `${env.SITE_URL}/authors/${a.slug}`,
          lastmod: a.updatedAt.toISOString(),
        }));
      }

      case "categories": {
        const categories = await prisma.category.findMany({
          where: { noIndex: false },
          skip,
          take: PAGE_SIZE,
          select: { slug: true, scope: true, updatedAt: true },
        });
        return categories.map((c) => ({
          loc: `${env.SITE_URL}/${c.scope === "BLOG" ? "blogs" : c.scope === "RESEARCH" ? "research" : "articles"}/category/${c.slug}`,
          lastmod: c.updatedAt.toISOString(),
        }));
      }

      case "static":
        return [
          { loc: `${env.SITE_URL}/`, lastmod: new Date().toISOString() },
          { loc: `${env.SITE_URL}/about`, lastmod: new Date().toISOString() },
          { loc: `${env.SITE_URL}/contact`, lastmod: new Date().toISOString() },
        ];
    }
  }

  buildSitemapXml(entries: SitemapEntry[]): string {
    const urls = entries
      .map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod></url>`)
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  }

  buildSitemapIndexXml(types: SitemapType[]): string {
    const sitemaps = types
      .map(
        (t) =>
          `  <sitemap><loc>${env.API_URL}/sitemaps/${t}-1.xml</loc><lastmod>${new Date().toISOString()}</lastmod></sitemap>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps}
</sitemapindex>`;
  }

  async findRedirect(prisma: PrismaClient, path: string) {
    return prisma.urlRedirect.findUnique({ where: { fromPath: path } });
  }

  async listRedirects(prisma: PrismaClient, skip = 0, take = 50) {
    const [redirects, total] = await Promise.all([
      prisma.urlRedirect.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.urlRedirect.count(),
    ]);

    return { redirects, total };
  }

  async createRedirect(
    prisma: PrismaClient,
    fromPath: string,
    toPath: string,
    statusCode = 301
  ) {
    return prisma.urlRedirect.create({
      data: { fromPath, toPath, statusCode, isAuto: false },
    });
  }

  async deleteRedirect(prisma: PrismaClient, id: string): Promise<void> {
    const redirect = await prisma.urlRedirect.findUnique({ where: { id } });

    if (!redirect) {
      throw new NotFoundError("Redirect not found");
    }

    await prisma.urlRedirect.delete({ where: { id } });
  }

  async createPreviewToken(
    prisma: PrismaClient,
    entityType: string,
    entityId: string,
    createdById: string
  ): Promise<string> {
    const token = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(
      Date.now() + env.PREVIEW_TOKEN_TTL_MINUTES * 60 * 1000
    );

    await prisma.previewToken.create({
      data: { tokenHash, entityType, entityId, createdById, expiresAt },
    });

    return token;
  }

  async verifyPreviewToken(prisma: PrismaClient, token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const previewToken = await prisma.previewToken.findUnique({
      where: { tokenHash },
    });

    if (!previewToken || previewToken.expiresAt < new Date()) {
      throw new NotFoundError("Invalid or expired preview token");
    }

    return previewToken;
  }
}

export default new SeoService();
