import { PrismaClient, ContactMessage } from "@prisma/client";
import { NotFoundError, ValidationFailedError } from "@/lib/errors";
import { sendContactNotification } from "@/lib/mailer";
import { SubmitContactInput, ListMessagesQuery } from "./contact.schema";

class ContactService {
  async submitMessage(
    prisma: PrismaClient,
    data: SubmitContactInput,
    ip: string
  ): Promise<ContactMessage> {
    if (data.website) {
      throw new ValidationFailedError("Invalid submission");
    }

    const message = await prisma.contactMessage.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        ip,
      },
    });

    try {
      await sendContactNotification(
        data.name,
        data.email,
        data.subject || "Website contact",
        data.message,
        data.phone
      );
    } catch (error) {
      console.error("Contact notification email failed:", error);
    }

    return message;
  }

  async listMessages(prisma: PrismaClient, query: ListMessagesQuery) {
    const skip = (query.page - 1) * query.limit;
    const where = query.isRead !== undefined ? { isRead: query.isRead } : {};

    const [messages, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contactMessage.count({ where }),
    ]);

    return { messages, total };
  }

  async markRead(prisma: PrismaClient, id: string): Promise<ContactMessage> {
    const message = await prisma.contactMessage.findUnique({ where: { id } });

    if (!message) {
      throw new NotFoundError("Message not found");
    }

    return prisma.contactMessage.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async exportCsv(prisma: PrismaClient): Promise<string> {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });

    const header = "Date,Name,Email,Phone,Subject,Message,Read\n";
    const rows = messages
      .map((m) =>
        [
          m.createdAt.toISOString(),
          csvEscape(m.name),
          csvEscape(m.email),
          csvEscape(m.phone || ""),
          csvEscape(m.subject || ""),
          csvEscape(m.message),
          m.isRead ? "yes" : "no",
        ].join(",")
      )
      .join("\n");

    return header + rows;
  }
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default new ContactService();
