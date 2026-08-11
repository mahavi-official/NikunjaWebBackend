import { z } from "zod";

export const mediaUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string(),
  folder: z.string().default("/"),
});

export const mediaListSchema = z.object({
  folder: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const mediaUpdateSchema = z.object({
  alt: z.string().optional(),
  folder: z.string().optional(),
});

export const mediaResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  alt: z.string().nullable(),
  folder: z.string(),
  variants: z.any().nullable(),
  createdAt: z.date(),
});

export const mediaListResponseSchema = z.object({
  media: z.array(mediaResponseSchema),
  total: z.number(),
});

export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type MediaResponse = z.infer<typeof mediaResponseSchema>;
