import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import { env } from "@/config/env";

export interface JwtPayload {
  sub: string;
  role: string;
  editorModules?: string[];
}

export function generateAccessToken(userId: string, role: string, editorModules: string[] = []): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      editorModules,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_TTL,
      issuer: "radhakundah",
      audience: "radhakundah-app",
    }
  );
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  return payload;
}

export function generateRefreshToken(): string {
  return Array.from({ length: 32 })
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
