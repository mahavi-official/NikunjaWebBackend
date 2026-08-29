import { PrismaClient, Research, Prisma } from "@prisma/client";
import { generateUniqueSlug, handleSlugChange } from "@/lib/slug";
import { extensionForMime } from "@/lib/upload-validation";
import { NotFoundError } from "@/lib/errors";
import {
  uploadToBlobStorage,
  deleteFromBlobStorage,
  getSignedBlobUrl,
  generateBlobName,
} from "@/lib/blob-storage";
import { extractPdfText, truncatePdfText } from "@/lib/pdf";
import tagsService from "@/modules/tags/tags.service";
import { CreateResearchInput, UpdateResearchInput, ListResearchQuery } from "./research.schema";

const RESEARCH_INCLUDE = {
  category: true,
  ogImage: true,
  authors: { include: { author: true }, orderBy: { order: "asc" } },
  files: { orderBy: { order: "asc" } },
  tags: { include: { tag: true } },
} satisfies Prisma.ResearchInclude;

class ResearchService {
  async createResearch(
    prisma: PrismaClient,
    data: CreateResearchInput
  ): Promise<Research> {
    const slug = data.slug || (await generateUniqueSlug(prisma, data.title, "research"));
    const tags = await tagsService.findOrCreateTags(prisma, data.tagNames);

    return prisma.research.create({
      data: {
        title: data.title,
        slug,
        abstract: data.abstract,
        categoryId: data.categoryId,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        status: data.publishedAt ? "PUBLISHED" : "DRAFT",
        isFeatured: data.isFeatured,
        doi: data.doi,
        journal: data.journal,
        volume: data.volume,
        issue: data.issue,
        pages: data.pages,
        publicationYear: data.publicationYear,
        keywords: data.keywords,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ogImageId: data.ogImageId,
        noIndex: data.noIndex,
        authors: {
          create: data.authorIds.map((a) => ({
            authorId: a.authorId,
            order: a.order,
            isCorresponding: a.isCorresponding,
          })),
        },
        tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
      },
      include: RESEARCH_INCLUDE,
    });
  }

  async getResearch(prisma: PrismaClient, id: string) {
    const research = await prisma.research.findUnique({
      where: { id },
      include: RESEARCH_INCLUDE,
    });

    if (!research) {
      throw new NotFoundError("Research not found");
    }

    return research;
  }

  async getResearchBySlug(prisma: PrismaClient, slug: string, publishedOnly = true) {
    const research = await prisma.research.findUnique({
      where: { slug },
      include: RESEARCH_INCLUDE,
    });

    if (!research) {
      throw new NotFoundError("Research not found");
    }

    if (publishedOnly) {
      const isLive =
        research.status === "PUBLISHED" &&
        research.publishedAt &&
        research.publishedAt <= new Date();
      if (!isLive) {
        throw new NotFoundError("Research not found");
      }
    }

    return research;
  }

  async listResearch(
    prisma: PrismaClient,
    query: ListResearchQuery,
    publishedOnly = true
  ) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.ResearchWhereInput = {};

    if (publishedOnly) {
      where.status = "PUBLISHED";
      where.publishedAt = { lte: new Date() };
    }

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.author) {
      where.authors = { some: { author: { slug: query.author } } };
    }

    if (query.year) {
      where.publicationYear = query.year;
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { abstract: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [research, total] = await Promise.all([
      prisma.research.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { publishedAt: "desc" },
        include: RESEARCH_INCLUDE,
      }),
      prisma.research.count({ where }),
    ]);

    return { research: research.map(stripExtractedText), total };
  }

  async updateResearch(
    prisma: PrismaClient,
    id: string,
    data: UpdateResearchInput
  ): Promise<Research> {
    const existing = await this.getResearch(prisma, id);

    let slug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      slug = data.slug;
      if (existing.status === "PUBLISHED") {
        await handleSlugChange(prisma, existing.slug, slug, "research", "");
      }
    }

    const updateData: Prisma.ResearchUpdateInput = {
      ...(data.title && { title: data.title }),
      ...(slug !== existing.slug && { slug }),
      ...(data.abstract && { abstract: data.abstract }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      doi: data.doi,
      journal: data.journal,
      volume: data.volume,
      issue: data.issue,
      pages: data.pages,
      publicationYear: data.publicationYear,
      ...(data.keywords && { keywords: data.keywords }),
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      ...(data.categoryId !== undefined && {
        category: data.categoryId
          ? { connect: { id: data.categoryId } }
          : { disconnect: true },
      }),
      ...(data.ogImageId !== undefined && {
        ogImage: data.ogImageId
          ? { connect: { id: data.ogImageId } }
          : { disconnect: true },
      }),
    };

    if (data.authorIds) {
      await prisma.researchAuthor.deleteMany({ where: { researchId: id } });
      updateData.authors = {
        create: data.authorIds.map((a) => ({
          authorId: a.authorId,
          order: a.order,
          isCorresponding: a.isCorresponding,
        })),
      };
    }

    if (data.tagNames) {
      const tags = await tagsService.findOrCreateTags(prisma, data.tagNames);
      await prisma.researchTag.deleteMany({ where: { researchId: id } });
      updateData.tags = { create: tags.map((tag) => ({ tagId: tag.id })) };
    }

    return prisma.research.update({
      where: { id },
      data: updateData,
      include: RESEARCH_INCLUDE,
    });
  }

  async publishResearch(prisma: PrismaClient, id: string): Promise<Research> {
    await this.getResearch(prisma, id);

    return prisma.research.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: RESEARCH_INCLUDE,
    });
  }

  async unpublishResearch(prisma: PrismaClient, id: string): Promise<Research> {
    await this.getResearch(prisma, id);

    return prisma.research.update({
      where: { id },
      data: { status: "DRAFT" },
      include: RESEARCH_INCLUDE,
    });
  }

  async deleteResearch(prisma: PrismaClient, id: string): Promise<void> {
    const research = await this.getResearch(prisma, id);

    for (const file of research.files) {
      await deleteFromBlobStorage("private", file.blobName);
    }

    await prisma.research.delete({ where: { id } });
  }

  async uploadResearchFile(
    prisma: PrismaClient,
    researchId: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    label: string
  ) {
    const research = await this.getResearch(prisma, researchId);

    // Extension follows the sniffed type, not the client's filename.
    const blobName = generateBlobName(
      `research/${researchId}`,
      fileName,
      extensionForMime(mimeType)
    );
    await uploadToBlobStorage("private", blobName, buffer, mimeType);

    const { text, pageCount } = await extractPdfText(buffer);

    const file = await prisma.researchFile.create({
      data: {
        researchId,
        label,
        blobName,
        fileName,
        mimeType,
        sizeBytes: buffer.length,
        pageCount,
        order: research.files.length,
      },
    });

    if (text) {
      const combinedText = truncatePdfText(
        `${research.extractedText || ""}\n${text}`.trim()
      );
      await prisma.research.update({
        where: { id: researchId },
        data: { extractedText: combinedText },
      });
    }

    return file;
  }

  async deleteResearchFile(prisma: PrismaClient, fileId: string): Promise<void> {
    const file = await prisma.researchFile.findUnique({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundError("File not found");
    }

    await deleteFromBlobStorage("private", file.blobName);
    await prisma.researchFile.delete({ where: { id: fileId } });
  }

  async getGatedViewUrl(
    prisma: PrismaClient,
    slug: string,
    userId: string,
    fileId: string | undefined,
    ip: string
  ): Promise<{ url: string; fileName: string }> {
    const research = await this.getResearchBySlug(prisma, slug);

    const file = fileId
      ? research.files.find((f) => f.id === fileId)
      : research.files[0];

    if (!file) {
      throw new NotFoundError("File not found");
    }

    const url = await getSignedBlobUrl("private", file.blobName);

    await prisma.researchView.create({
      data: {
        researchId: research.id,
        userId,
        fileId: file.id,
        ip,
      },
    });

    return { url, fileName: file.fileName };
  }

  async incrementViewCount(prisma: PrismaClient, slug: string): Promise<void> {
    await prisma.research.updateMany({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });
  }
}

function stripExtractedText<T extends { extractedText: string | null }>(
  research: T
): Omit<T, "extractedText"> {
  const { extractedText: _extractedText, ...rest } = research;
  return rest;
}

export default new ResearchService();
