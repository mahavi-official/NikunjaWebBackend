import { PrismaClient, Video, VideoCategory, Prisma } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slug";
import { NotFoundError, ValidationFailedError } from "@/lib/errors";
import {
  CreateVideoInput,
  UpdateVideoInput,
  CreateVideoCategoryInput,
  ListVideosQuery,
} from "./videos.schema";

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
  /(?:youtu\.be\/)([\w-]{11})/,
  /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  /(?:youtube\.com\/embed\/)([\w-]{11})/,
];

export function parseYoutubeId(url: string): string {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  throw new ValidationFailedError("Invalid YouTube URL", [
    { field: "youtubeUrl", message: "Could not parse a YouTube video ID" },
  ]);
}

function youtubeThumbnail(youtubeId: string): string {
  return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
}

class VideosService {
  async createVideo(prisma: PrismaClient, data: CreateVideoInput): Promise<Video> {
    const youtubeId = parseYoutubeId(data.youtubeUrl);
    const slug = data.slug || (await generateUniqueSlug(prisma, data.title, "video"));

    return prisma.video.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        youtubeId,
        thumbnailUrl: youtubeThumbnail(youtubeId),
        durationSec: data.durationSec,
        categoryId: data.categoryId,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        status: data.publishedAt ? "PUBLISHED" : "DRAFT",
        isFeatured: data.isFeatured,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        noIndex: data.noIndex,
      },
      include: { category: true },
    });
  }

  async getVideo(prisma: PrismaClient, id: string) {
    const video = await prisma.video.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!video) {
      throw new NotFoundError("Video not found");
    }

    return video;
  }

  async getVideoBySlug(prisma: PrismaClient, slug: string, publishedOnly = true) {
    const video = await prisma.video.findUnique({
      where: { slug },
      include: { category: true },
    });

    if (!video) {
      throw new NotFoundError("Video not found");
    }

    if (publishedOnly) {
      const isLive =
        video.status === "PUBLISHED" && video.publishedAt && video.publishedAt <= new Date();
      if (!isLive) {
        throw new NotFoundError("Video not found");
      }
    }

    return video;
  }

  async listVideos(prisma: PrismaClient, query: ListVideosQuery, publishedOnly = true) {
    const skip = (query.page - 1) * query.limit;
    const where: Prisma.VideoWhereInput = {};

    if (publishedOnly) {
      where.status = "PUBLISHED";
      where.publishedAt = { lte: new Date() };
    }

    if (query.category) {
      where.category = { slug: query.category };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { publishedAt: "desc" },
        include: { category: true },
      }),
      prisma.video.count({ where }),
    ]);

    return { videos, total };
  }

  async updateVideo(
    prisma: PrismaClient,
    id: string,
    data: UpdateVideoInput
  ): Promise<Video> {
    await this.getVideo(prisma, id);

    const youtubeId = data.youtubeUrl ? parseYoutubeId(data.youtubeUrl) : undefined;

    return prisma.video.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        description: data.description,
        ...(youtubeId && {
          youtubeId,
          thumbnailUrl: youtubeThumbnail(youtubeId),
        }),
        durationSec: data.durationSec,
        categoryId: data.categoryId,
        ...(data.publishedAt !== undefined && {
          publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        }),
        ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      },
      include: { category: true },
    });
  }

  async publishVideo(prisma: PrismaClient, id: string): Promise<Video> {
    await this.getVideo(prisma, id);

    return prisma.video.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
      include: { category: true },
    });
  }

  async unpublishVideo(prisma: PrismaClient, id: string): Promise<Video> {
    await this.getVideo(prisma, id);

    return prisma.video.update({
      where: { id },
      data: { status: "DRAFT" },
      include: { category: true },
    });
  }

  async deleteVideo(prisma: PrismaClient, id: string): Promise<void> {
    await this.getVideo(prisma, id);

    await prisma.video.delete({ where: { id } });
  }

  async incrementViewCount(prisma: PrismaClient, slug: string): Promise<void> {
    await prisma.video.updateMany({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });
  }

  async createCategory(
    prisma: PrismaClient,
    data: CreateVideoCategoryInput
  ): Promise<VideoCategory> {
    const slug =
      data.slug || (await generateUniqueSlug(prisma, data.name, "videoCategory"));

    return prisma.videoCategory.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        noIndex: data.noIndex,
      },
    });
  }

  async listCategories(prisma: PrismaClient) {
    return prisma.videoCategory.findMany({ orderBy: { order: "asc" } });
  }

  async deleteCategory(prisma: PrismaClient, id: string): Promise<void> {
    const category = await prisma.videoCategory.findUnique({ where: { id } });

    if (!category) {
      throw new NotFoundError("Video category not found");
    }

    await prisma.videoCategory.delete({ where: { id } });
  }
}

export default new VideosService();
