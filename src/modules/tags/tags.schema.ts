import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
