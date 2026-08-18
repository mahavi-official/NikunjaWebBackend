import { z } from "zod";

export const createCommentSchema = z.object({
  postId: z.string(),
  body: z.string().min(1).max(5000),
});

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const listCommentsSchema = z.object({
  postId: z.string(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsSchema>;
