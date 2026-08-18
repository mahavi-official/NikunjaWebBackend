import { z } from "zod";

export const createVideoSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  youtubeUrl: z.string().url(),
  durationSec: z.number().int().optional(),
  categoryId: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  isFeatured: z.boolean().default(false),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateVideoSchema = createVideoSchema.partial();

export const createVideoCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const listVideosSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type CreateVideoCategoryInput = z.infer<typeof createVideoCategorySchema>;
export type ListVideosQuery = z.infer<typeof listVideosSchema>;
