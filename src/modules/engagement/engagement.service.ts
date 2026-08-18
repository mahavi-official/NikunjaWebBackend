import { PrismaClient, Comment } from "@prisma/client";
import { NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";
import { CreateCommentInput, UpdateCommentInput, ListCommentsQuery } from "./engagement.schema";

class EngagementService {
  async likePost(prisma: PrismaClient, postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > new Date()) {
      throw new NotFoundError("Post not found");
    }

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      throw new ConflictError("Already liked");
    }

    await prisma.like.create({ data: { postId, userId } });
  }

  async unlikePost(prisma: PrismaClient, postId: string, userId: string): Promise<void> {
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (!existing) {
      throw new NotFoundError("Like not found");
    }

    await prisma.like.delete({ where: { postId_userId: { postId, userId } } });
  }

  async getLikeCount(prisma: PrismaClient, postId: string): Promise<number> {
    return prisma.like.count({ where: { postId } });
  }

  async createComment(
    prisma: PrismaClient,
    data: CreateCommentInput,
    userId: string
  ): Promise<Comment> {
    const post = await prisma.post.findUnique({ where: { id: data.postId } });

    if (!post || post.status !== "PUBLISHED" || !post.publishedAt || post.publishedAt > new Date()) {
      throw new NotFoundError("Post not found");
    }

    if (!post.commentsEnabled) {
      throw new ForbiddenError("Comments are disabled on this post");
    }

    return prisma.comment.create({
      data: {
        postId: data.postId,
        userId,
        body: data.body,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async listComments(prisma: PrismaClient, query: ListCommentsQuery, includeHidden = false) {
    const skip = (query.page - 1) * query.limit;
    const where = {
      postId: query.postId,
      ...(includeHidden ? {} : { isHidden: false }),
    };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return { comments, total };
  }

  async updateComment(
    prisma: PrismaClient,
    id: string,
    data: UpdateCommentInput,
    userId: string
  ): Promise<Comment> {
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    if (comment.userId !== userId) {
      throw new ForbiddenError("Cannot edit another user's comment");
    }

    return prisma.comment.update({
      where: { id },
      data: { body: data.body },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async deleteComment(
    prisma: PrismaClient,
    id: string,
    userId: string,
    isStaff: boolean
  ): Promise<void> {
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    if (comment.userId !== userId && !isStaff) {
      throw new ForbiddenError("Cannot delete another user's comment");
    }

    await prisma.comment.delete({ where: { id } });
  }

  async hideComment(prisma: PrismaClient, id: string, isHidden: boolean): Promise<Comment> {
    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    return prisma.comment.update({
      where: { id },
      data: { isHidden },
    });
  }
}

export default new EngagementService();
