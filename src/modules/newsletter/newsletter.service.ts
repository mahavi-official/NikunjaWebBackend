import { PrismaClient, Subscriber } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { NotFoundError } from "@/lib/errors";

class NewsletterService {
  async subscribe(
    prisma: PrismaClient,
    email: string,
    ip: string
  ): Promise<Subscriber> {
    const existing = await prisma.subscriber.findUnique({ where: { email } });

    if (existing) {
      if (!existing.isActive) {
        return prisma.subscriber.update({
          where: { email },
          data: { isActive: true },
        });
      }
      return existing;
    }

    return prisma.subscriber.create({
      data: {
        email,
        unsubscribeToken: randomBytes(24).toString("hex"),
        ip,
      },
    });
  }

  async unsubscribe(prisma: PrismaClient, token: string): Promise<void> {
    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      throw new NotFoundError("Subscription not found");
    }

    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { isActive: false },
    });
  }

  async listSubscribers(prisma: PrismaClient, skip = 0, take = 50) {
    const [subscribers, total] = await Promise.all([
      prisma.subscriber.findMany({
        where: { isActive: true },
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.subscriber.count({ where: { isActive: true } }),
    ]);

    return { subscribers, total };
  }

  async exportCsv(prisma: PrismaClient): Promise<string> {
    const subscribers = await prisma.subscriber.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const header = "Email,Subscribed At\n";
    const rows = subscribers
      .map((s) => `"${s.email}",${s.createdAt.toISOString()}`)
      .join("\n");

    return header + rows;
  }
}

export default new NewsletterService();
