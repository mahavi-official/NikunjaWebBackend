import { z } from "zod";

export const submitContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string().optional(),
  message: z.string().min(1),
  // Honeypot: must be empty. Bots fill it in.
  website: z.string().max(0).optional(),
  recaptchaToken: z.string().optional(),
});

export const listMessagesSchema = z.object({
  isRead: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type SubmitContactInput = z.infer<typeof submitContactSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesSchema>;
