import { PrismaClient, Media } from "@prisma/client";
import { uploadToS3, deleteFromS3, generateS3Key } from "@/lib/s3";
import { generateImageDerivatives, getImageDimensions } from "@/lib/image";
import { NotFoundError } from "@/lib/errors";

class MediaService {
  async uploadMedia(
    prisma: PrismaClient,
    file: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
    userId: string
  ): Promise<Media> {
    const s3Key = generateS3Key(folder, fileName);
    let width: number | null = null;
    let height: number | null = null;
    let variants: any = null;

    if (mimeType.startsWith("image/")) {
      const dims = await getImageDimensions(file);
      width = dims.width;
      height = dims.height;

      try {
        const { derivatives } = await generateImageDerivatives(file, mimeType);
        variants = derivatives;
      } catch (error) {
        console.error("Image derivative generation error:", error);
      }
    }

    const url = await uploadToS3("public", s3Key, file, mimeType);

    return prisma.media.create({
      data: {
        s3Key,
        url,
        fileName,
        mimeType,
        sizeBytes: file.length,
        width,
        height,
        folder,
        variants,
        uploadedById: userId,
      },
    });
  }

  async getMedia(prisma: PrismaClient, id: string): Promise<Media> {
    const media = await prisma.media.findUnique({
      where: { id },
    });

    if (!media) {
      throw new NotFoundError("Media not found");
    }

    return media;
  }

  async listMedia(
    prisma: PrismaClient,
    folder?: string,
    skip: number = 0,
    take: number = 20
  ): Promise<{ media: Media[]; total: number }> {
    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where: folder ? { folder } : undefined,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.media.count({
        where: folder ? { folder } : undefined,
      }),
    ]);

    return { media, total };
  }

  async updateMedia(
    prisma: PrismaClient,
    id: string,
    data: { alt?: string; folder?: string }
  ): Promise<Media> {
    await this.getMedia(prisma, id);

    return prisma.media.update({
      where: { id },
      data,
    });
  }

  async deleteMedia(prisma: PrismaClient, id: string): Promise<void> {
    const media = await this.getMedia(prisma, id);

    await deleteFromS3("public", media.s3Key);

    await prisma.media.delete({
      where: { id },
    });
  }
}

export default new MediaService();
