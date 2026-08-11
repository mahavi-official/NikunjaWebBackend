import { z } from "zod";

export const createResearchSchema = z.object({
  title: z.string().min(1),
  slug: z.string().optional(),
  abstract: z.string().min(1),
  categoryId: z.string().optional(),
  authorIds: z
    .array(
      z.object({
        authorId: z.string(),
        order: z.number().int().default(0),
        isCorresponding: z.boolean().default(false),
      })
    )
    .default([]),
  tagNames: z.array(z.string()).default([]),
  publishedAt: z.string().datetime().optional(),
  isFeatured: z.boolean().default(false),
  doi: z.string().optional(),
  journal: z.string().optional(),
  volume: z.string().optional(),
  issue: z.string().optional(),
  pages: z.string().optional(),
  publicationYear: z.number().int().optional(),
  keywords: z.array(z.string()).default([]),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageId: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateResearchSchema = createResearchSchema.partial();

export const listResearchSchema = z.object({
  category: z.string().optional(),
  author: z.string().optional(),
  year: z.coerce.number().int().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateResearchInput = z.infer<typeof createResearchSchema>;
export type UpdateResearchInput = z.infer<typeof updateResearchSchema>;
export type ListResearchQuery = z.infer<typeof listResearchSchema>;
