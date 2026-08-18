import { PrismaClient } from "@prisma/client";
import slugify from "slugify";

export async function generateUniqueSlug(
  prisma: PrismaClient,
  title: string,
  entityType: "post" | "research" | "author" | "category" | "tag" | "video" | "gallerySegment" | "videoCategory",
  excludeId?: string
): Promise<string> {
  const baseSlug = slugify(title, { lower: true, strict: true });
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    let exists = false;

    switch (entityType) {
      case "post":
        exists = !!(await prisma.post.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "research":
        exists = !!(await prisma.research.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "author":
        exists = !!(await prisma.author.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "category":
        exists = !!(await prisma.category.findUnique({
          where: { scope_slug: { scope: "ARTICLE", slug } },
          select: { id: true },
        }));
        break;
      case "tag":
        exists = !!(await prisma.tag.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "video":
        exists = !!(await prisma.video.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "gallerySegment":
        exists = !!(await prisma.gallerySegment.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
      case "videoCategory":
        exists = !!(await prisma.videoCategory.findUnique({
          where: { slug },
          select: { id: true },
        }));
        break;
    }

    if (excludeId && exists) {
      const item = await prisma.$queryRawUnsafe(
        `SELECT id FROM "${entityType === "post" ? "Post" : entityType === "research" ? "Research" : "Author"}" WHERE slug = $1`,
        slug
      );
      if ((item as any[])?.[0]?.id === excludeId) {
        return slug;
      }
    }

    if (!exists) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

export async function handleSlugChange(
  prisma: PrismaClient,
  oldSlug: string,
  newSlug: string,
  entityType: "post" | "research",
  urlBase: string
): Promise<void> {
  const fromPath = entityType === "post" ? `/articles/${oldSlug}` : `/research/${oldSlug}`;
  const toPath = entityType === "post" ? `/articles/${newSlug}` : `/research/${newSlug}`;

  await prisma.urlRedirect.upsert({
    where: { fromPath },
    update: { toPath },
    create: {
      fromPath,
      toPath,
      statusCode: 301,
      isAuto: true,
    },
  });

  if (entityType === "post" && urlBase.includes("BOTH")) {
    const blogFromPath = `/blogs/${oldSlug}`;
    const blogToPath = `/articles/${newSlug}`;
    await prisma.urlRedirect.upsert({
      where: { fromPath: blogFromPath },
      update: { toPath: blogToPath },
      create: {
        fromPath: blogFromPath,
        toPath: blogToPath,
        statusCode: 301,
        isAuto: false,
      },
    });
  }

  const existingChains = await prisma.urlRedirect.findMany({
    where: { toPath: fromPath },
  });

  for (const chain of existingChains) {
    await prisma.urlRedirect.update({
      where: { id: chain.id },
      data: { toPath },
    });
  }
}
