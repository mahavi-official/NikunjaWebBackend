import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config/env";
import { randomBytes } from "crypto";

export type S3Bucket = "public" | "private";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

function getBucketName(bucket: S3Bucket): string {
  return bucket === "public" ? env.S3_BUCKET_PUBLIC : env.S3_BUCKET_PRIVATE;
}

export async function uploadToS3(
  bucket: S3Bucket,
  key: string,
  buffer: Buffer,
  contentType: string,
  options?: { cacheControl?: string; metadata?: Record<string, string> }
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: options?.cacheControl || "max-age=31536000",
      Metadata: options?.metadata,
    })
  );

  if (bucket === "public") {
    return `${env.S3_PUBLIC_BASE_URL}/${key}`;
  }

  return key;
}

export async function getPresignedUrl(
  bucket: S3Bucket,
  key: string,
  expirationSeconds: number = env.SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
    { expiresIn: expirationSeconds }
  );
}

export async function deleteFromS3(bucket: S3Bucket, key: string): Promise<void> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
}

export function generateS3Key(folder: string, fileName: string): string {
  const timestamp = Date.now();
  const random = randomBytes(8).toString("hex");
  const ext = fileName.split(".").pop();
  return `${folder}/${timestamp}-${random}.${ext}`;
}
