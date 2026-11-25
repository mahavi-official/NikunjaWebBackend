import {
  BlobSASPermissions,
  BlobServiceClient,
  ContainerClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { env } from "@/config/env";
import { randomBytes } from "crypto";

/**
 * Logical storage buckets, mapped onto Azure Blob Storage containers:
 *   - `public`  — media library, served from the account itself or from a CDN
 *                 in front of it (see `getPublicBaseUrl`)
 *   - `private` — research PDFs, reachable only through a short-lived SAS URL
 *   - `backup`  — nightly database dumps
 */
export type BlobContainer = "public" | "private" | "backup";

let credential: StorageSharedKeyCredential | null = null;
let blobServiceClient: BlobServiceClient | null = null;

function getEndpoint(): string {
  return (
    env.AZURE_STORAGE_BLOB_ENDPOINT ||
    `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`
  );
}

function getCredential(): StorageSharedKeyCredential {
  if (!credential) {
    credential = new StorageSharedKeyCredential(
      env.AZURE_STORAGE_ACCOUNT_NAME,
      env.AZURE_STORAGE_ACCOUNT_KEY
    );
  }
  return credential;
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = new BlobServiceClient(getEndpoint(), getCredential());
  }
  return blobServiceClient;
}

function getContainerName(container: BlobContainer): string {
  switch (container) {
    case "public":
      return env.AZURE_STORAGE_CONTAINER_PUBLIC;
    case "private":
      return env.AZURE_STORAGE_CONTAINER_PRIVATE;
    case "backup":
      return env.AZURE_STORAGE_CONTAINER_BACKUP;
  }
}

function getContainerClient(container: BlobContainer): ContainerClient {
  return getBlobServiceClient().getContainerClient(getContainerName(container));
}

/**
 * Where `public` blobs are readable from.
 *
 * Derived from the same endpoint and container the upload itself used, so the
 * URL we persist cannot drift from where the bytes actually went. It used to
 * come from `AZURE_BLOB_PUBLIC_BASE_URL` alone, which is an independent value:
 * when it was pointed at the wrong account — and without the container segment
 * — every media row got a URL that 404s, and `next/image` on the frontend
 * throws a 500 rather than render an unconfigured host.
 *
 * The env var stays supported as an override for a CDN or custom domain, but
 * it must name the container it fronts, and it is checked on the way in.
 */
function getPublicBaseUrl(): string {
  const derived = `${getEndpoint().replace(/\/+$/, "")}/${getContainerName("public")}`;

  const override = env.AZURE_BLOB_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!override) return derived;

  // A base URL that does not end in the public container is the exact drift
  // described above. Refuse it rather than write 404s into the database.
  if (!new URL(override).pathname.replace(/\/+$/, "").endsWith(`/${getContainerName("public")}`)) {
    console.error(
      `[blob-storage] ignoring AZURE_BLOB_PUBLIC_BASE_URL="${override}": it does not end in the ` +
        `public container ("${getContainerName("public")}"), so it cannot address uploaded blobs. ` +
        `Using ${derived} instead.`
    );
    return derived;
  }

  return override;
}

/**
 * Uploads a buffer and returns the CDN URL for `public` uploads, or the blob
 * name for `private`/`backup` uploads (which are only ever served through a
 * signed URL, so a bare URL would be useless).
 */
export async function uploadToBlobStorage(
  container: BlobContainer,
  blobName: string,
  buffer: Buffer,
  contentType: string,
  options?: { cacheControl?: string; metadata?: Record<string, string> }
): Promise<string> {
  const blockBlobClient = getContainerClient(container).getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobCacheControl: options?.cacheControl || "max-age=31536000",
    },
    metadata: options?.metadata,
  });

  if (container === "public") {
    return `${getPublicBaseUrl()}/${blobName}`;
  }

  return blobName;
}

/**
 * Issues a read-only SAS URL for a blob. This is the Azure equivalent of an S3
 * presigned URL and is how gated research PDFs are handed to signed-in users.
 */
export async function getSignedBlobUrl(
  container: BlobContainer,
  blobName: string,
  expirationSeconds: number = env.SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const blockBlobClient = getContainerClient(container).getBlockBlobClient(blobName);

  const now = Date.now();
  const sas = generateBlobSASQueryParameters(
    {
      containerName: getContainerName(container),
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      // HTTPS-only against real Azure. Only a plain-http endpoint — i.e. an
      // AZURE_STORAGE_BLOB_ENDPOINT pointed at Azurite in local dev — relaxes this.
      protocol: getEndpoint().startsWith("https:")
        ? SASProtocol.Https
        : SASProtocol.HttpsAndHttp,
      // Backdated a little so a small clock skew between this host and Azure
      // cannot reject a URL that was only just issued.
      startsOn: new Date(now - 5 * 60 * 1000),
      expiresOn: new Date(now + expirationSeconds * 1000),
    },
    getCredential()
  );

  return `${blockBlobClient.url}?${sas.toString()}`;
}

/** Deletes a blob. A blob that is already gone is not an error. */
export async function deleteFromBlobStorage(
  container: BlobContainer,
  blobName: string
): Promise<void> {
  const blockBlobClient = getContainerClient(container).getBlockBlobClient(blobName);

  await blockBlobClient.deleteIfExists({ deleteSnapshots: "include" });
}

/**
 * Builds a collision-proof blob name of the form `folder/<timestamp>-<random>.<ext>`.
 * Leading and trailing slashes are trimmed off the folder: Azure accepts them but
 * a leading `/` produces a blob nested under an empty-named virtual directory.
 */
export function generateBlobName(
  folder: string,
  fileName: string,
  preferredExt?: string
): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  const prefix = folder.replace(/^\/+|\/+$/g, "");

  // The extension comes off a client-supplied filename, and Azure treats `/`
  // in a blob name as a virtual directory — so an unfiltered one lets the
  // uploader choose the path and the served extension (`x.jpg/../../evil.html`
  // was a valid input here). Reduce it to plain alphanumerics.
  const dot = fileName.lastIndexOf(".");
  const raw = (preferredExt ?? (dot > 0 ? fileName.slice(dot + 1) : "")).toLowerCase();
  const ext = raw.replace(/[^a-z0-9]/g, "").slice(0, 8);
  const name = ext ? `${timestamp}-${random}.${ext}` : `${timestamp}-${random}`;

  return prefix ? `${prefix}/${name}` : name;
}
