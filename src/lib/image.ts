import sharp from "sharp";

export interface ImageDerivatives {
  thumb: { webp: string; original: string };
  medium: { webp: string; original: string };
  large: { webp: string; original: string };
  og: { webp: string; original: string };
}

const DERIVATIVE_SIZES = {
  thumb: { width: 200, height: 200 },
  medium: { width: 600, height: 400 },
  large: { width: 1200, height: 800 },
  og: { width: 1200, height: 630 },
};

export async function generateImageDerivatives(
  buffer: Buffer,
  mimeType: string
): Promise<{ derivatives: ImageDerivatives; original: Buffer }> {
  const derivatives: ImageDerivatives = {
    thumb: { webp: "", original: "" },
    medium: { webp: "", original: "" },
    large: { webp: "", original: "" },
    og: { webp: "", original: "" },
  };

  // Process each derivative size
  for (const [size, dimensions] of Object.entries(DERIVATIVE_SIZES)) {
    const pipeline = sharp(buffer)
      .rotate()
      .resize(dimensions.width, dimensions.height, {
        fit: "cover",
        position: "center",
      });

    // Generate WebP version
    const webpBuffer = await pipeline.clone().webp({ quality: 80 }).toBuffer();
    derivatives[size as keyof ImageDerivatives].webp = webpBuffer.toString("base64");

    // Generate original format version
    const originalBuffer = await pipeline
      .toFormat(mimeType.split("/")[1] as any, { quality: 90 })
      .toBuffer();
    derivatives[size as keyof ImageDerivatives].original = originalBuffer.toString("base64");
  }

  // Store original as is
  const originalWithoutExif = await sharp(buffer).rotate().toBuffer();

  return { derivatives, original: originalWithoutExif };
}

export function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  return sharp(buffer).metadata().then((meta) => ({
    width: meta.width || 0,
    height: meta.height || 0,
  }));
}
