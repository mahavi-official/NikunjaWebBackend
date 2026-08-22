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
 *   - `public`  — media library, fronted by the CDN at AZURE_BLOB_PUBLIC_BASE_URL
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
    return `${env.AZURE_BLOB_PUBLIC_BASE_URL}/${blobName}`;
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
export function generateBlobName(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  const prefix = folder.replace(/^\/+|\/+$/g, "");

  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  const name = ext ? `${timestamp}-${random}.${ext}` : `${timestamp}-${random}`;

  return prefix ? `${prefix}/${name}` : name;
}
