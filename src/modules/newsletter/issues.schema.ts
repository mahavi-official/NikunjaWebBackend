import { z } from "zod";

export const issueStatusEnum = z.enum(["DRAFT", "PUBLISHED"]);

export const createIssueSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  coverImageId: z.string().optional(),
  /** Supplying it publishes the issue on the site (it does not email it). */
  publishedAt: z.string().datetime().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

/** PATCH body. Nullable where the field can be cleared. */
export const updateIssueSchema = z.object({
  title: z.string().trim().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  slug: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  coverImageId: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  noIndex: z.boolean().optional(),
});

export const listIssuesSchema = z.object({
  status: issueStatusEnum.optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const testSendSchema = z.object({
  /** Defaults to the signed-in staff member's own address. */
  email: z.string().email().optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type ListIssuesQuery = z.infer<typeof listIssuesSchema>;
