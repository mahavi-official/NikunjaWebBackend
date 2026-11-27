-- Lets an article or blog credit authors from the Authors directory.
-- Additive only: one new table; no existing table, column or row is changed.

-- CreateTable
CREATE TABLE "PostAuthor" (
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostAuthor_pkey" PRIMARY KEY ("postId","authorId")
);

-- CreateIndex
CREATE INDEX "PostAuthor_authorId_idx" ON "PostAuthor"("authorId");

-- AddForeignKey
ALTER TABLE "PostAuthor" ADD CONSTRAINT "PostAuthor_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostAuthor" ADD CONSTRAINT "PostAuthor_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE CASCADE ON UPDATE CASCADE;
