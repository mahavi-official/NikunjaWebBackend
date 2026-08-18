import { z } from "zod";

export const authCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const logoutSchema = z.object({
  sessionId: z.string().optional(),
});

export type AuthCallbackInput = z.infer<typeof authCallbackSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    editorModules: z.array(z.string()),
    avatarUrl: z.string().nullable(),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
