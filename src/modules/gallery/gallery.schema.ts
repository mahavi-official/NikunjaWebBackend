import { z } from "zod";

export const createSegmentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  coverImageId: z.string().optional(),
  isPublished: z.boolean().default(true),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateSegmentSchema = createSegmentSchema.partial();

export const addImagesSchema = z.object({
  images: z.array(
    z.object({
      mediaId: z.string(),
      alt: z.string().min(1),
      caption: z.string().optional(),
    })
  ),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), order: z.number().int() })),
});

export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
export type AddImagesInput = z.infer<typeof addImagesSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
