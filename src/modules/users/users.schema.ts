import { z } from "zod";

export const userRoleEnum = z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "MEMBER"]);
export const userStatusEnum = z.enum(["WHITELISTED", "ACTIVE", "SUSPENDED"]);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: userRoleEnum.default("MEMBER"),
  editorModules: z.array(z.string()).default([]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: userRoleEnum.optional(),
  editorModules: z.array(z.string()).optional(),
});

export const suspendUserSchema = z.object({});

export const activateUserSchema = z.object({});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleEnum,
  status: userStatusEnum,
  editorModules: z.array(z.string()),
  lastLoginAt: z.date().nullable(),
  createdAt: z.date(),
});

export const usersListSchema = z.object({
  users: z.array(userResponseSchema),
  total: z.number(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
