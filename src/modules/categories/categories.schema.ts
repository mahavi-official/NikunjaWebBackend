import { z } from "zod";

const scopeEnum = z.enum(["ARTICLE", "BLOG", "RESEARCH"]);

export const createCategorySchema = z.object({
  scope: scopeEnum,
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateCategorySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().optional(),
});

export const categoryResponseSchema = z.object({
  id: z.string(),
  scope: scopeEnum,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  noIndex: z.boolean(),
  createdAt: z.date(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryResponse = z.infer<typeof categoryResponseSchema>;
