import { FastifyRequest, FastifyReply } from "fastify";
import { env } from "@/config/env";
import { generateAccessToken, generateRefreshToken, hashToken } from "@/lib/jwt";
import { successResponse } from "@/lib/response";
import { exchangeCodeForTokens, getGoogleProfile, getGoogleAuthUrl } from "@/lib/oauth";
import { logAuthEvent } from "@/lib/audit";

export const authController = {
  async googleStart(_request: FastifyRequest, reply: FastifyReply) {
    const authUrl = getGoogleAuthUrl();
    return reply.redirect(authUrl);
  },

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code } = request.query as { code: string };

    if (!code) {
      return reply.status(400).send({ error: "Missing code" });
    }

    try {
      const { accessToken: googleAccessToken } = await exchangeCodeForTokens(code);
      const profile = await getGoogleProfile(googleAccessToken);

      let user = await request.server.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user?.status === "SUSPENDED") {
        return reply.status(403).send({ error: "Account suspended" });
      }

      if (!user) {
        user = await request.server.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture,
            provider: "GOOGLE",
            providerId: profile.sub,
            status: "ACTIVE",
          },
        });

        await logAuthEvent(request.server.prisma, request, "auth.signup", user.id, {
          provider: "GOOGLE",
        });
      } else if (!user.providerId) {
        user = await request.server.prisma.user.update({
          where: { id: user.id },
          data: {
            provider: "GOOGLE",
            providerId: profile.sub,
            avatarUrl: profile.picture,
            lastLoginAt: new Date(),
          },
        });
      } else {
        await request.server.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }

      const refreshTokenStr = generateRefreshToken();
      const tokenHash = hashToken(refreshTokenStr);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await request.server.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash,
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          expiresAt,
        },
      });

      const accessToken = generateAccessToken(user.id, user.role, user.editorModules);

      await logAuthEvent(request.server.prisma, request, "auth.login", user.id, {
        provider: "GOOGLE",
      });

      reply.setCookie("refreshToken", tokenHash, {
        domain: env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.redirect(`${env.SITE_URL}/auth/callback?token=${accessToken}`);
    } catch (error) {
      console.error("Google OAuth error:", error);
      reply.status(500).send({ error: "Authentication failed" });
    }
  },

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(401).send({ error: "Missing refresh token" });
    }

    try {
      const session = await request.server.prisma.session.findUnique({
        where: { tokenHash: refreshToken },
      });

      if (!session || session.revokedAt) {
        return reply.status(401).send({ error: "Invalid or revoked session" });
      }

      const user = await request.server.prisma.user.findUnique({
        where: { id: session.userId },
      });

      if (!user || user.status === "SUSPENDED") {
        return reply.status(401).send({ error: "User not found or suspended" });
      }

      const newRefreshToken = generateRefreshToken();
      const newTokenHash = hashToken(newRefreshToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await request.server.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await request.server.prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: newTokenHash,
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          expiresAt,
        },
      });

      const accessToken = generateAccessToken(user.id, user.role, user.editorModules);

      reply.setCookie("refreshToken", newTokenHash, {
        domain: env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60,
      });

      return reply.send(
        successResponse({
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        })
      );
    } catch (error) {
      console.error("Refresh token error:", error);
      reply.status(401).send({ error: "Invalid refresh token" });
    }
  },

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const refreshToken = request.cookies.refreshToken;

    if (!refreshToken) {
      return reply.status(400).send({ error: "No active session" });
    }

    try {
      const session = await request.server.prisma.session.findUnique({
        where: { tokenHash: refreshToken },
      });

      if (session) {
        await request.server.prisma.session.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }

      await logAuthEvent(request.server.prisma, request, "auth.logout", request.user?.id);

      reply.clearCookie("refreshToken", {
        domain: env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
      });

      return reply.send(successResponse({ message: "Logged out" }));
    } catch (error) {
      console.error("Logout error:", error);
      reply.status(500).send({ error: "Logout failed" });
    }
  },

  async logoutAll(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({ error: "Not authenticated" });
    }

    try {
      await request.server.prisma.session.updateMany({
        where: { userId: request.user.id },
        data: { revokedAt: new Date() },
      });

      await logAuthEvent(
        request.server.prisma,
        request,
        "auth.logout_all",
        request.user.id
      );

      reply.clearCookie("refreshToken", {
        domain: env.COOKIE_DOMAIN,
        path: "/api/v1/auth",
      });

      return reply.send(successResponse({ message: "All sessions revoked" }));
    } catch (error) {
      console.error("Logout all error:", error);
      reply.status(500).send({ error: "Logout failed" });
    }
  },
};
