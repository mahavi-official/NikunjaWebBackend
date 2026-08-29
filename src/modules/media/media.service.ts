import { PrismaClient, Media } from "@prisma/client";
import {
  uploadToBlobStorage,
  deleteFromBlobStorage,
  generateBlobName,
} from "@/lib/blob-storage";
import {
  derivativeFormat,
  generateImageDerivatives,
  getImageDimensions,
  type DerivativeSize,
  type ImageDerivatives,
} from "@/lib/image";
import { extensionForMime } from "@/lib/upload-validation";
import { NotFoundError } from "@/lib/errors";

/** `folder/1699-abc.jpg` → `folder/1699-abc`, so renditions can be suffixed. */
function blobStem(blobName: string): string {
  return blobName.replace(/\.[^./]+$/, "");
}

/** Every blob a media row owns: the original plus its eight renditions. */
export function derivativeBlobNames(blobName: string, mimeType: string): string[] {
  const stem = blobStem(blobName);
  const format = derivativeFormat(mimeType);
  const sizes: DerivativeSize[] = ["thumb", "medium", "large", "og"];

  return sizes.flatMap((size) =>
    format === "webp"
      ? [`${stem}_${size}.webp`]
      : [`${stem}_${size}.webp`, `${stem}_${size}.${format}`]
  );
}

/**
 * Uploads every rendition and returns the URL map persisted in
 * `Media.variants` — the shape the frontend already expects, and the one the
 * seed has always written: `{ thumb: { webp, original }, ... }`.
 */
async function uploadDerivatives(
  blobName: string,
  derivatives: ImageDerivatives,
  mimeType: string
): Promise<Record<DerivativeSize, { webp: string; original: string }>> {
  const stem = blobStem(blobName);
  const format = derivativeFormat(mimeType);

  const entries = await Promise.all(
    (Object.keys(derivatives) as DerivativeSize[]).map(async (size) => {
      const webp = await uploadToBlobStorage(
        "public",
        `${stem}_${size}.webp`,
        derivatives[size].webp,
        "image/webp"
      );

      // A WebP upload has one rendition, so both keys point at the same blob
      // rather than writing identical bytes twice under two names.
      const original =
        format === "webp"
          ? webp
          : await uploadToBlobStorage(
              "public",
              `${stem}_${size}.${format}`,
              derivatives[size].original,
              `image/${format}`
            );

      return [size, { webp, original }] as const;
    })
  );

  return Object.fromEntries(entries) as Record<DerivativeSize, { webp: string; original: string }>;
}

class MediaService {
  async uploadMedia(
    prisma: PrismaClient,
    file: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
    userId: string
  ): Promise<Media> {
    // `mimeType` has been sniffed from the bytes by the controller, so the
    // extension it implies is trustworthy in a way the filename's is not.
    const blobName = generateBlobName(folder, fileName, extensionForMime(mimeType));
    let width: number | null = null;
    let height: number | null = null;
    let variants: any = null;

    if (mimeType.startsWith("image/")) {
      const dims = await getImageDimensions(file);
      width = dims.width;
      height = dims.height;

      // Best-effort: a media row with no derivatives still renders from its
      // original, so a sharp failure must not fail the whole upload.
      try {
        const { derivatives } = await generateImageDerivatives(file, mimeType);
        variants = await uploadDerivatives(blobName, derivatives, mimeType);
      } catch (error) {
        console.error("Image derivative generation error:", error);
      }
    }

    const url = await uploadToBlobStorage("public", blobName, file, mimeType);

    return prisma.media.create({
      data: {
        blobName,
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

    await deleteFromBlobStorage("public", media.blobName);

    // Renditions are separate blobs now, so deleting only the original would
    // leave them orphaned in the container with nothing referencing them.
    // Best-effort: a rendition that never uploaded simply is not there, and a
    // failure here must not block removing the row.
    if (media.mimeType.startsWith("image/")) {
      await Promise.all(
        derivativeBlobNames(media.blobName, media.mimeType).map((name) =>
          deleteFromBlobStorage("public", name).catch((error) =>
            console.error(`Failed to delete derivative ${name}:`, error)
          )
        )
      );
    }

    await prisma.media.delete({
      where: { id },
    });
  }
}

export default new MediaService();
