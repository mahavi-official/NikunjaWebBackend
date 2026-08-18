import { PrismaClient, User } from "@prisma/client";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { CreateUserInput, UpdateUserInput } from "./users.schema";

class UsersService {
  async createUser(prisma: PrismaClient, data: CreateUserInput): Promise<User> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictError("User with this email already exists");
    }

    return prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        editorModules: data.editorModules,
        status: "WHITELISTED",
      },
    });
  }

  async getUser(prisma: PrismaClient, userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }

  async updateUser(
    prisma: PrismaClient,
    userId: string,
    data: UpdateUserInput,
    actorId: string,
    actorRole: string
  ): Promise<User> {
    const user = await this.getUser(prisma, userId);

    this.checkSuperAdminProtection(user, actorId, actorRole);

    return prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.editorModules && { editorModules: data.editorModules }),
      },
    });
  }

  async suspendUser(
    prisma: PrismaClient,
    userId: string,
    actorId: string,
    actorRole: string
  ): Promise<User> {
    const user = await this.getUser(prisma, userId);

    this.checkSuperAdminProtection(user, actorId, actorRole);
    this.checkRoleHierarchy(user.role, actorRole);

    return prisma.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED" },
    });
  }

  async activateUser(
    prisma: PrismaClient,
    userId: string,
    _actorId: string,
    __actorRole: string
  ): Promise<User> {
    await this.getUser(prisma, userId);

    return prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });
  }

  async deleteUser(
    prisma: PrismaClient,
    userId: string,
    actorId: string,
    actorRole: string
  ): Promise<void> {
    const user = await this.getUser(prisma, userId);

    this.checkSuperAdminProtection(user, actorId, actorRole);
    this.checkRoleHierarchy(user.role, actorRole);

    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async listUsers(
    prisma: PrismaClient,
    skip: number = 0,
    take: number = 20
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  }

  async getUserSessions(prisma: PrismaClient, userId: string) {
    return prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  async revokeSession(prisma: PrismaClient, sessionId: string, userId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundError("Session not found");
    }

    return prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  private checkSuperAdminProtection(
    user: User,
    actorId: string,
    _actorRole: string
  ): void {
    if (user.isProtected && user.id !== actorId) {
      throw new ForbiddenError("Cannot modify protected super admin");
    }
  }

  private checkRoleHierarchy(targetRole: string, actorRole: string): void {
    const roleHierarchy = {
      SUPER_ADMIN: 4,
      ADMIN: 3,
      EDITOR: 2,
      MEMBER: 1,
    };

    const actorLevel = roleHierarchy[actorRole as keyof typeof roleHierarchy] || 0;
    const targetLevel =
      roleHierarchy[targetRole as keyof typeof roleHierarchy] || 0;

    if (targetLevel >= actorLevel && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Cannot manage users of equal or higher role");
    }
  }
}

export default new UsersService();
