import { z } from "zod";

export const placementEnum = z.enum(["ARTICLE", "BLOG", "BOTH"]);
export const statusEnum = z.enum(["DRAFT", "PUBLISHED"]);

export const createPostSchema = z.object({
  placement: placementEnum,
  title: z.string().min(1),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  coverImageId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  tagNames: z.array(z.string()).default([]),
  publishedAt: z.string().datetime().optional(),
  isFeatured: z.boolean().default(false),
  commentsEnabled: z.boolean().default(true),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
  ogImageId: z.string().optional(),
  canonicalUrl: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updatePostSchema = createPostSchema.partial();

export const listPostsSchema = z.object({
  placement: placementEnum.optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  status: statusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsSchema>;
