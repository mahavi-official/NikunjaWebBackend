import { z } from "zod";

export const createAuthorSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  affiliation: z.string().optional(),
  bio: z.string().optional(),
  photoId: z.string().optional(),
  email: z.string().email().optional(),
  orcid: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateAuthorSchema = createAuthorSchema.partial();

export type CreateAuthorInput = z.infer<typeof createAuthorSchema>;
export type UpdateAuthorInput = z.infer<typeof updateAuthorSchema>;
