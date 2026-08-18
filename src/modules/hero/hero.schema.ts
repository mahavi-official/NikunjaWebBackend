import { z } from "zod";

export const createSlideSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageId: z.string(),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateSlideSchema = createSlideSchema.partial();

export type CreateSlideInput = z.infer<typeof createSlideSchema>;
export type UpdateSlideInput = z.infer<typeof updateSlideSchema>;
