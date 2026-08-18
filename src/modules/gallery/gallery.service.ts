import { PrismaClient, GallerySegment } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slug";
import { NotFoundError } from "@/lib/errors";
import {
  CreateSegmentInput,
  UpdateSegmentInput,
  AddImagesInput,
  ReorderInput,
} from "./gallery.schema";

class GalleryService {
  async createSegment(
    prisma: PrismaClient,
    data: CreateSegmentInput
  ): Promise<GallerySegment> {
    const slug =
      data.slug || (await generateUniqueSlug(prisma, data.name, "gallerySegment"));

    return prisma.gallerySegment.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        coverImageId: data.coverImageId,
        isPublished: data.isPublished,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        noIndex: data.noIndex,
      },
    });
  }

  async getSegment(prisma: PrismaClient, id: string) {
    const segment = await prisma.gallerySegment.findUnique({
      where: { id },
      include: {
        coverImage: true,
        images: { include: { media: true }, orderBy: { order: "asc" } },
      },
    });

    if (!segment) {
      throw new NotFoundError("Gallery segment not found");
    }

    return segment;
  }

  async getSegmentBySlug(prisma: PrismaClient, slug: string, publishedOnly = true) {
    const segment = await prisma.gallerySegment.findUnique({
      where: { slug },
      include: {
        coverImage: true,
        images: { include: { media: true }, orderBy: { order: "asc" } },
      },
    });

    if (!segment || (publishedOnly && !segment.isPublished)) {
      throw new NotFoundError("Gallery segment not found");
    }

    return segment;
  }

  async listSegments(
    prisma: PrismaClient,
    publishedOnly = true,
    skip = 0,
    take = 50
  ) {
    const where = publishedOnly ? { isPublished: true } : {};

    const [segments, total] = await Promise.all([
      prisma.gallerySegment.findMany({
        where,
        skip,
        take,
        orderBy: { order: "asc" },
        include: { coverImage: true, _count: { select: { images: true } } },
      }),
      prisma.gallerySegment.count({ where }),
    ]);

    return { segments, total };
  }

  async updateSegment(
    prisma: PrismaClient,
    id: string,
    data: UpdateSegmentInput
  ): Promise<GallerySegment> {
    await this.getSegment(prisma, id);

    return prisma.gallerySegment.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        description: data.description,
        coverImageId: data.coverImageId,
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      },
    });
  }

  async deleteSegment(prisma: PrismaClient, id: string): Promise<void> {
    await this.getSegment(prisma, id);

    await prisma.gallerySegment.delete({ where: { id } });
  }

  async addImages(prisma: PrismaClient, segmentId: string, data: AddImagesInput) {
    const segment = await this.getSegment(prisma, segmentId);
    let order = segment.images.length;

    const created = [];
    for (const image of data.images) {
      created.push(
        await prisma.galleryImage.create({
          data: {
            segmentId,
            mediaId: image.mediaId,
            alt: image.alt,
            caption: image.caption,
            order: order++,
          },
          include: { media: true },
        })
      );
    }

    return created;
  }

  async deleteImage(prisma: PrismaClient, imageId: string): Promise<void> {
    const image = await prisma.galleryImage.findUnique({ where: { id: imageId } });

    if (!image) {
      throw new NotFoundError("Image not found");
    }

    await prisma.galleryImage.delete({ where: { id: imageId } });
  }

  async reorderImages(prisma: PrismaClient, data: ReorderInput): Promise<void> {
    await prisma.$transaction(
      data.items.map((item) =>
        prisma.galleryImage.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
  }
}

export default new GalleryService();
