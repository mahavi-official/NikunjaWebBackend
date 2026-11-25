import { fileTypeFromBuffer } from "file-type";
import { FILE_LIMITS } from "@/config/constants";

/**
 * Upload gatekeeping.
 *
 * The client controls the filename, the declared MIME type and the byte count
 * it claims to send, so none of those decide anything here. The type is read
 * back out of the bytes and checked against an allowlist, and the size is
 * measured from the buffer we actually received.
 */

/**
 * Raster formats the media library accepts, mapped to the extension we store
 * them under.
 *
 * SVG is deliberately absent. It is a script-bearing document, not an image,
 * and these blobs are served from a public container — an uploaded SVG is
 * stored XSS against anyone who opens it. Anything not listed is refused
 * rather than passed through on trust.
 */
const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"],
  ["image/tiff", "tiff"],
]);

const ALLOWED_DOCUMENT_TYPES = new Map<string, string>([["application/pdf", "pdf"]]);

export type UploadKind = "image" | "document";

/**
 * The extension a detected type is stored under.
 *
 * Callers pass this to `generateBlobName` so the blob's extension follows the
 * bytes rather than the client's filename — otherwise an upload named
 * `x.<script>` lands as a `.script` blob. Harmless while the served
 * `Content-Type` comes from the detected type, but it stops being harmless the
 * moment anything in front of the container infers a type from the path.
 */
export function extensionForMime(mimeType: string): string | undefined {
  return ALLOWED_IMAGE_TYPES.get(mimeType) ?? ALLOWED_DOCUMENT_TYPES.get(mimeType);
}

export type UploadCheck =
  | { ok: true; mimeType: string; ext: string }
  | { ok: false; status: number; error: string };

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Validates an upload's real type and size.
 *
 * `kind` selects the allowlist and the size ceiling. The returned `mimeType`
 * is the detected one and should be persisted in place of whatever the client
 * declared.
 */
export async function checkUpload(buffer: Buffer, kind: UploadKind): Promise<UploadCheck> {
  const allowed = kind === "image" ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
  const maxBytes = kind === "image" ? FILE_LIMITS.IMAGE_MAX_BYTES : FILE_LIMITS.PDF_MAX_BYTES;
  const maxMb = kind === "image" ? FILE_LIMITS.IMAGE_MAX_MB : FILE_LIMITS.PDF_MAX_MB;

  if (buffer.length === 0) {
    return { ok: false, status: 400, error: "The uploaded file is empty" };
  }

  if (buffer.length > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `File is ${megabytes(buffer.length)}; the limit is ${maxMb}MB`,
    };
  }

  // Reads the magic bytes. Returns undefined for text-shaped files (SVG, HTML,
  // scripts), which is exactly the class we want to refuse.
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    return {
      ok: false,
      status: 415,
      error:
        kind === "image"
          ? "That file is not a recognised image. SVG and text-based files are not accepted."
          : "That file is not a recognised document.",
    };
  }

  const ext = allowed.get(detected.mime);
  if (!ext) {
    return {
      ok: false,
      status: 415,
      error: `${detected.mime} is not accepted here. Allowed: ${[...allowed.keys()].join(", ")}`,
    };
  }

  return { ok: true, mimeType: detected.mime, ext };
}

/**
 * Reduces a caller-supplied folder to something safe to use as a blob prefix.
 *
 * The folder arrives on the query string, so without this a value like
 * `../../` would climb out of the intended prefix and let an uploader choose
 * where in the container their blob lands.
 */
export function sanitizeFolder(folder: string): string {
  return folder
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "").replace(/^\.+$/, ""))
    .filter(Boolean)
    .join("/");
}
