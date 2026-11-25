import sharp from "sharp";

export type DerivativeSize = "thumb" | "medium" | "large" | "og";

/** One rendition of one size, as bytes ready to be uploaded. */
export interface DerivativeBuffers {
  webp: Buffer;
  original: Buffer;
}

export type ImageDerivatives = Record<DerivativeSize, DerivativeBuffers>;

const DERIVATIVE_SIZES: Record<DerivativeSize, { width: number; height: number }> = {
  thumb: { width: 200, height: 200 },
  medium: { width: 600, height: 400 },
  large: { width: 1200, height: 800 },
  og: { width: 1200, height: 630 },
};

/** Raster formats sharp can encode. Anything else (SVG, HEIC) falls back to WebP. */
const ENCODABLE = new Set(["jpeg", "png", "webp", "avif", "tiff", "gif"]);

/**
 * The format the non-WebP rendition is written in, as a bare extension.
 *
 * Derived from the upload's MIME type so a PNG keeps its transparency, with a
 * WebP fallback for anything sharp cannot encode — passing e.g. `svg+xml`
 * straight to `toFormat` throws.
 */
export function derivativeFormat(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.toLowerCase() ?? "";
  const format = subtype === "jpg" ? "jpeg" : subtype;
  return ENCODABLE.has(format) ? format : "webp";
}

/**
 * Renders each size at both WebP and the upload's own format.
 *
 * Returns bytes, not base64: the renditions are uploaded to blob storage by
 * the caller and only their URLs are persisted. They were previously
 * base64-encoded straight into `Media.variants`, which put megabytes of image
 * data in a database column, bloated every API response that embedded a media
 * row, and produced a `variants` value that could never be used as an `src`.
 */
export async function generateImageDerivatives(
  buffer: Buffer,
  mimeType: string
): Promise<{ derivatives: ImageDerivatives; original: Buffer }> {
  const format = derivativeFormat(mimeType);
  const derivatives = {} as ImageDerivatives;

  for (const [size, dimensions] of Object.entries(DERIVATIVE_SIZES) as [
    DerivativeSize,
    { width: number; height: number },
  ][]) {
    const pipeline = sharp(buffer).rotate().resize(dimensions.width, dimensions.height, {
      fit: "cover",
      position: "center",
      // Never scale a source up to hit a nominal size. A 1200x630 upload fed
      // the 1200x800 `large` rendition a 1.27x enlargement, which is why cover
      // images came out soft on the public pages. Downscaling is lossless to
      // the eye; upscaling is not, and a slightly smaller rendition is always
      // better than a blurry one.
      withoutEnlargement: true,
    });

    const webp = await pipeline.clone().webp({ quality: 80 }).toBuffer();

    derivatives[size] = {
      webp,
      // Same bytes when the upload is already WebP — no point encoding twice,
      // and the caller stores one URL for both.
      original:
        format === "webp"
          ? webp
          : await pipeline
              .clone()
              .toFormat(format as keyof sharp.FormatEnum, { quality: 90 })
              .toBuffer(),
    };
  }

  // The original is kept as uploaded, minus the EXIF orientation flag that
  // `rotate()` has already baked into the pixels.
  const originalWithoutExif = await sharp(buffer).rotate().toBuffer();

  return { derivatives, original: originalWithoutExif };
}

export function getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  return sharp(buffer)
    .metadata()
    .then((meta) => ({
      width: meta.width || 0,
      height: meta.height || 0,
    }));
}
