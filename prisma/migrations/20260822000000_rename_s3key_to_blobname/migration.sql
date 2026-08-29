-- Storage moved from S3 to Azure Blob Storage. The column holds a blob name now,
-- not an S3 object key, so rename it rather than leaving a misleading name behind.
-- RENAME COLUMN carries the unique index over with it, so only the index name
-- needs a separate rename to stay in step with Prisma's naming convention.

-- AlterTable
ALTER TABLE "Media" RENAME COLUMN "s3Key" TO "blobName";

-- AlterTable
ALTER TABLE "ResearchFile" RENAME COLUMN "s3Key" TO "blobName";

-- RenameIndex
ALTER INDEX "Media_s3Key_key" RENAME TO "Media_blobName_key";

-- RenameIndex
ALTER INDEX "ResearchFile_s3Key_key" RENAME TO "ResearchFile_blobName_key";
