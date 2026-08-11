import { PrismaClient, Post, Prisma } from "@prisma/client";
import { generateUniqueSlug, handleSlugChange } from "@/lib/slug";
import { sanitizeRichText, stripHtmlTags, truncateText } from "@/lib/sanitize";
import { NotFoundError } from "@/lib/errors";
import tagsService from "@/modules/tags/tags.service";
import { CreatePostInput, UpdatePostInput, ListPostsQuery } from "./posts.schema";

const POST_INCLUDE = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  coverImage: true,
  ogImage: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude;

class PostsService {
  async createPost(
    prisma: PrismaClient,
    data: CreatePostInput,
    authorId: string
  ): Promise<Post> {
    const slug = data.slug || (await generateUniqueSlug(prisma, data.title, "post"));
    const content = sanitizeRichText(data.content);
    const tags = await tagsService.findOrCreateTags(prisma, data.tagNames);

    const post = await prisma.post.create({
      data: {
        placement: data.placement,
        title: data.title,
        slug,
        excerpt: data.excerpt || truncateText(stripHtmlTags(content), 200),
        content,
        coverImageId: data.coverImageId,
        authorId,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
        status: data.publishedAt ? "PUBLISHED" : "DRAFT",
        isFeatured: data.isFeatured,
        commentsEnabled: data.commentsEnabled,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        metaKeywords: data.metaKeywords,
        ogImageId: data.ogImageId,
        canonicalUrl: data.canonicalUrl,
        noIndex: data.noIndex,
        categories: {
          create: data.categoryIds.map((categoryId) => ({ categoryId })),
        },
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id })),
        },
      },
      include: POST_INCLUDE,
    });

    if (data.placement === "BOTH") {
      await prisma.urlRedirect.upsert({
        where: { fromPath: `/blogs/${slug}` },
        update: { toPath: `/articles/${slug}` },
        create: {
          fromPath: `/blogs/${slug}`,
          toPath: `/articles/${slug}`,
          statusCode: 301,
          isAuto: false,
        },
      });
    }

    return post;
  }

  async getPost(prisma: PrismaClient, id: string) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    return post;
  }

  async getPostBySlug(prisma: PrismaClient, slug: string, publishedOnly = true) {
    const post = await prisma.post.findUnique({
      where: { slug },
      include: POST_INCLUDE,
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    if (publishedOnly) {
      const isLive =
        post.status === "PUBLISHED" && post.publishedAt && post.publishedAt <= new Date();
      if (!isLive) {
        throw new NotFoundError("Post not found");
      }
    }

    return post;
  }

  async listPosts(prisma: PrismaClient, query: ListPostsQuery, publishedOnly = true) {
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.PostWhereInput = {};

    if (publishedOnly) {
      where.status = "PUBLISHED";
      where.publishedAt = { lte: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.placement) {
      where.placement =
        query.placement === "BOTH" ? "BOTH" : { in: [query.placement, "BOTH"] };
    }

    if (query.category) {
      where.categories = { some: { category: { slug: query.category } } };
    }

    if (query.tag) {
      where.tags = { some: { tag: { slug: query.tag } } };
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { excerpt: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { publishedAt: "desc" },
        include: POST_INCLUDE,
      }),
      prisma.post.count({ where }),
    ]);

    return { posts: posts.map(stripContent), total };
  }

  async updatePost(
    prisma: PrismaClient,
    id: string,
    data: UpdatePostInput
  ): Promise<Post> {
    const existing = await this.getPost(prisma, id);

    let slug = existing.slug;
    if (data.slug && data.slug !== existing.slug) {
      slug = data.slug;
      if (existing.status === "PUBLISHED") {
        await handleSlugChange(
          prisma,
          existing.slug,
          slug,
          "post",
          existing.placement
        );
      }
    }

    const updateData: Prisma.PostUpdateInput = {
      ...(data.title && { title: data.title }),
      ...(slug !== existing.slug && { slug }),
      ...(data.placement && { placement: data.placement }),
      ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
      ...(data.content && { content: sanitizeRichText(data.content) }),
      ...(data.publishedAt !== undefined && {
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : null,
      }),
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      ...(data.commentsEnabled !== undefined && { commentsEnabled: data.commentsEnabled }),
      ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
      ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
      ...(data.metaKeywords !== undefined && { metaKeywords: data.metaKeywords }),
      ...(data.canonicalUrl !== undefined && { canonicalUrl: data.canonicalUrl }),
      ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      ...(data.coverImageId !== undefined && {
        coverImage: data.coverImageId
          ? { connect: { id: data.coverImageId } }
          : { disconnect: true },
      }),
      ...(data.ogImageId !== undefined && {
        ogImage: data.ogImageId
          ? { connect: { id: data.ogImageId } }
          : { disconnect: true },
      }),
    };

    if (data.categoryIds) {
      await prisma.postCategory.deleteMany({ where: { postId: id } });
      updateData.categories = {
        create: data.categoryIds.map((categoryId) => ({ categoryId })),
      };
    }

    if (data.tagNames) {
      const tags = await tagsService.findOrCreateTags(prisma, data.tagNames);
      await prisma.postTag.deleteMany({ where: { postId: id } });
      updateData.tags = { create: tags.map((tag) => ({ tagId: tag.id })) };
    }

    return prisma.post.update({
      where: { id },
      data: updateData,
      include: POST_INCLUDE,
    });
  }

  async publishPost(prisma: PrismaClient, id: string): Promise<Post> {
    await this.getPost(prisma, id);

    return prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      include: POST_INCLUDE,
    });
  }

  async unpublishPost(prisma: PrismaClient, id: string): Promise<Post> {
    await this.getPost(prisma, id);

    return prisma.post.update({
      where: { id },
      data: { status: "DRAFT" },
      include: POST_INCLUDE,
    });
  }

  async deletePost(prisma: PrismaClient, id: string): Promise<void> {
    await this.getPost(prisma, id);

    await prisma.post.delete({ where: { id } });
  }

  async incrementViewCount(prisma: PrismaClient, slug: string): Promise<void> {
    await prisma.post.updateMany({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });
  }
}

function stripContent<T extends { content: string }>(post: T): Omit<T, "content"> {
  const { content: _content, ...rest } = post;
  return rest;
}

export default new PostsService();
