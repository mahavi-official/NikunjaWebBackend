import { z } from "zod";

export const upsertPageSchema = z.object({
  title: z.string().min(1),
  sections: z.record(z.any()),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageId: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export type UpsertPageInput = z.infer<typeof upsertPageSchema>;
