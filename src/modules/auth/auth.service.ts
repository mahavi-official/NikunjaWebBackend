import { PrismaClient, User } from "@prisma/client";
import { exchangeCodeForTokens, getGoogleProfile } from "@/lib/oauth";
import { generateAccessToken, generateRefreshToken, hashToken } from "@/lib/jwt";
import { UnauthorizedError } from "@/lib/errors";
import { env } from "@/config/env";
import { AUDIT_ACTIONS } from "@/config/constants";

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async handleGoogleCallback(code: string, ip?: string): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
  }> {
    // Exchange code for tokens
    const { accessToken } = await exchangeCodeForTokens(code);

    // Get Google profile
    const profile = await getGoogleProfile(accessToken);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Update existing user
      if (!user.providerId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            provider: "GOOGLE",
            providerId: profile.sub,
            name: profile.name,
            avatarUrl: profile.picture,
            status: user.status === "WHITELISTED" ? "ACTIVE" : user.status,
            lastLoginAt: new Date(),
          },
        });
      } else {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name: profile.name,
            avatarUrl: profile.picture,
            lastLoginAt: new Date(),
          },
        });
      }
    } else {
      // Create new member
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture,
          provider: "GOOGLE",
          providerId: profile.sub,
          role: "MEMBER",
          status: "ACTIVE",
          lastLoginAt: new Date(),
        },
      });
    }

    // Check if user is suspended
    if (user.status === "SUSPENDED") {
      throw new UnauthorizedError("Account is suspended");
    }

    // Generate tokens
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Create session
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        ip,
        expiresAt,
      },
    });

    const accessTokenJwt = generateAccessToken(user.id, user.role, user.editorModules);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN,
        ip,
      },
    });

    return {
      user,
      accessToken: accessTokenJwt,
      refreshToken,
    };
  }

  async refreshSession(userId: string, refreshToken: string, ip?: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status === "SUSPENDED") {
      throw new UnauthorizedError("Invalid user or account suspended");
    }

    // Check if session exists and is valid
    const refreshTokenHash = hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: refreshTokenHash },
    });

    if (!session || session.expiresAt < new Date() || session.revokedAt) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    // Revoke old token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: newRefreshTokenHash,
        ip,
        expiresAt,
      },
    });

    const accessToken = generateAccessToken(user.id, user.role, user.editorModules);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AUDIT_ACTIONS.AUTH_REFRESH,
        ip,
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, sessionId?: string, ip?: string): Promise<void> {
    if (sessionId) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        ip,
      },
    });
  }

  async logoutAll(userId: string, ip?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AUDIT_ACTIONS.AUTH_LOGOUT_ALL,
        ip,
      },
    });
  }
}
