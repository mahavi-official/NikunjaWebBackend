import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import issuesService, { SendDeps } from "./issues.service";
import { htmlToText, renderIssueEmail } from "./issues.email";
import type { EmailOptions } from "@/lib/mailer";

// ───────────────────────────── in-memory Prisma fake ─────────────────────────────
// Only the calls the send path makes, with the same filter semantics.

interface Sub { id: string; email: string; unsubscribeToken: string; isActive: boolean }
interface Delivery { issueId: string; subscriberId: string; status: "SENT" | "FAILED"; error: string | null }

function makeDb(subscriberCount: number, issueOverrides: Record<string, unknown> = {}) {
  const subs: Sub[] = Array.from({ length: subscriberCount }, (_, i) => ({
    id: `s${String(i).padStart(4, "0")}`,
    email: `reader${i}@example.test`,
    unsubscribeToken: `tok${i}`,
    isActive: true,
  }));
  const deliveries: Delivery[] = [];
  const issue: Record<string, any> = {
    id: "issue1",
    title: "Kartik <notes>",
    subtitle: "A month at the kunda",
    slug: "kartik-notes",
    excerpt: null,
    content: '<p>Hello <a href="https://example.test">friends</a></p>',
    status: "DRAFT",
    publishedAt: null,
    sendStatus: "NOT_SENT",
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    author: { id: "u1", name: "Radha Dasi", avatarUrl: null },
    coverImage: null,
    ...issueOverrides,
  };

  const matchesSub = (s: Sub, where: any) => {
    if (where.isActive !== undefined && s.isActive !== where.isActive) return false;
    if (where.id?.gt && !(s.id > where.id.gt)) return false;
    const none = where.deliveries?.none;
    if (none && deliveries.some((d) => d.subscriberId === s.id && d.issueId === none.issueId && d.status === none.status)) {
      return false;
    }
    return true;
  };

  const prisma = {
    setting: { findUnique: async () => ({ key: "site.title", value: "Radhakundah" }) },
    newsletterIssue: {
      findUnique: async ({ where }: any) => (where.id === issue.id || where.slug === issue.slug ? { ...issue } : null),
      update: async ({ data }: any) => Object.assign(issue, data),
      updateMany: async ({ where, data }: any) => {
        const ok = where.OR.some(
          (c: any) =>
            (c.sendStatus?.in && c.sendStatus.in.includes(issue.sendStatus)) ||
            (c.sendStatus === issue.sendStatus && issue.failedCount > c.failedCount.gt)
        );
        if (!ok) return { count: 0 };
        Object.assign(issue, data);
        return { count: 1 };
      },
    },
    subscriber: {
      count: async ({ where }: any) => subs.filter((s) => matchesSub(s, where)).length,
      findMany: async ({ where, take }: any) =>
        subs
          .filter((s) => matchesSub(s, where))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take),
    },
    newsletterDelivery: {
      upsert: async ({ where, create, update }: any) => {
        const key = where.issueId_subscriberId;
        const existing = deliveries.find((d) => d.issueId === key.issueId && d.subscriberId === key.subscriberId);
        if (existing) Object.assign(existing, update);
        else deliveries.push({ ...create });
      },
      count: async ({ where }: any) =>
        deliveries.filter((d) => d.issueId === where.issueId && d.status === where.status).length,
    },
  };

  return { prisma: prisma as unknown as PrismaClient, subs, deliveries, issue };
}

function deps(send: (o: EmailOptions) => Promise<void>): SendDeps & { logs: string[] } {
  const logs: string[] = [];
  return { send, sleep: async () => {}, delayMs: 0, log: (m) => logs.push(m), logs };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// ───────────────────────────── tests ─────────────────────────────

describe("runSend", () => {
  it("emails every active subscriber exactly once across several batches", async () => {
    const { prisma, issue } = makeDb(137);
    const sent: EmailOptions[] = [];
    await issuesService.runSend(prisma, "issue1", deps(async (o) => void sent.push(o)));

    const recipients = sent.map((o) => o.to);
    expect(recipients).toHaveLength(137);
    expect(new Set(recipients).size).toBe(137);
    expect(issue.sendStatus).toBe("SENT");
    expect(issue.sentCount).toBe(137);
    expect(issue.failedCount).toBe(0);
  });

  it("gives each recipient their own unsubscribe link and one-click headers", async () => {
    const { prisma } = makeDb(2);
    const sent: EmailOptions[] = [];
    await issuesService.runSend(prisma, "issue1", deps(async (o) => void sent.push(o)));

    expect(sent[0].html).toContain("https://site.example.test/newsletter/unsubscribe/tok0");
    expect(sent[1].html).toContain("https://site.example.test/newsletter/unsubscribe/tok1");
    expect(sent[0].headers).toEqual({
      "List-Unsubscribe": "<https://api.example.test/api/v1/public/newsletter/unsubscribe/tok0>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("skips inactive subscribers and people who already have the issue, and retries failures", async () => {
    const { prisma, subs, deliveries } = makeDb(4, { sendStatus: "FAILED" });
    subs[0].isActive = false;
    deliveries.push({ issueId: "issue1", subscriberId: "s0001", status: "SENT", error: null });
    deliveries.push({ issueId: "issue1", subscriberId: "s0002", status: "FAILED", error: "timeout" });

    const sent: string[] = [];
    await issuesService.runSend(prisma, "issue1", deps(async (o) => void sent.push(o.to as string)));

    expect(sent).toEqual(["reader2@example.test", "reader3@example.test"]);
    expect(deliveries.filter((d) => d.status === "SENT")).toHaveLength(3);
  });

  it("records a bad address as FAILED and still finishes the run", async () => {
    const { prisma, issue, deliveries } = makeDb(3);
    await issuesService.runSend(
      prisma,
      "issue1",
      deps(async (o) => {
        if (o.to === "reader1@example.test") throw new Error("550 mailbox unavailable");
      })
    );

    expect(issue.sendStatus).toBe("SENT");
    expect(issue.sentCount).toBe(2);
    expect(issue.failedCount).toBe(1);
    expect(deliveries.find((d) => d.subscriberId === "s0001")?.error).toBe("550 mailbox unavailable");
  });

  it("stops after repeated failures in a row (broken SMTP) and marks the issue FAILED", async () => {
    const { prisma, issue } = makeDb(40);
    let attempts = 0;
    const d = deps(async () => {
      attempts++;
      throw new Error("535 auth failed");
    });
    await issuesService.runSend(prisma, "issue1", d);

    expect(attempts).toBe(5);
    expect(issue.sendStatus).toBe("FAILED");
    expect(d.logs[0]).toMatch(/5 failures in a row/);
  });
});

describe("startSend", () => {
  it("publishes a draft, claims it, and sends in the background", async () => {
    const { prisma, issue } = makeDb(3);
    const sent: string[] = [];
    const result = await issuesService.startSend(prisma, "issue1", deps(async (o) => void sent.push(o.to as string)));

    expect(result.sendStatus).toBe("SENDING");
    expect(result.recipientCount).toBe(3);
    expect(issue.status).toBe("PUBLISHED");
    expect(issue.publishedAt).toBeInstanceOf(Date);

    for (let i = 0; i < 20 && issue.sendStatus === "SENDING"; i++) await flush();
    expect(issue.sendStatus).toBe("SENT");
    expect(sent).toHaveLength(3);
  });

  it("refuses an issue that is already sending", async () => {
    const { prisma } = makeDb(3, { sendStatus: "SENDING" });
    await expect(issuesService.startSend(prisma, "issue1", deps(async () => {}))).rejects.toThrow(/already being sent/);
  });

  it("refuses an issue already delivered to everyone, but allows a retry when some failed", async () => {
    const done = makeDb(3, { sendStatus: "SENT", failedCount: 0 });
    await expect(issuesService.startSend(done.prisma, "issue1", deps(async () => {}))).rejects.toThrow(/already been sent/);

    const partial = makeDb(3, { sendStatus: "SENT", failedCount: 1 });
    const result = await issuesService.startSend(partial.prisma, "issue1", deps(async () => {}));
    expect(result.sendStatus).toBe("SENDING");
    for (let i = 0; i < 20 && partial.issue.sendStatus === "SENDING"; i++) await flush();
  });

  it("refuses when there is nobody to send to", async () => {
    const { prisma, issue } = makeDb(0);
    await expect(issuesService.startSend(prisma, "issue1", deps(async () => {}))).rejects.toThrow(/no active subscribers/);
    expect(issue.sendStatus).toBe("NOT_SENT");
  });
});

describe("renderIssueEmail", () => {
  const issue = {
    title: "Kartik <notes>",
    subtitle: "A month & more",
    content: '<p>See <img src="https://cdn.example.test/a.jpg" alt="kunda"></p>',
    slug: "kartik-notes",
    publishedAt: new Date("2026-11-01T00:00:00Z"),
    authorName: "Radha Dasi",
  };

  it("escapes the title, links the web version, and styles images for small screens", () => {
    const email = renderIssueEmail(issue, { siteName: "Radhakundah", siteUrl: "https://site.example.test/" });
    expect(email.subject).toBe("Kartik <notes>");
    expect(email.html).toContain("Kartik &lt;notes&gt;");
    expect(email.html).not.toContain("<h1 style=\"font-size:30px;line-height:1.2;margin:0;\">Kartik <notes>");
    expect(email.html).toContain("https://site.example.test/newsletter/kartik-notes");
    expect(email.html).toContain('<img style="max-width:100%;');
    expect(email.html).toContain("1 November 2026");
  });

  it("marks test sends and leaves out unsubscribe links and headers", () => {
    const email = renderIssueEmail(issue, { siteName: "Radhakundah", siteUrl: "https://site.example.test", subjectPrefix: "[Test]" });
    expect(email.subject).toBe("[Test] Kartik <notes>");
    expect(email.html).not.toContain("Unsubscribe</a>");
    expect(email.headers).toEqual({});
  });

  it("builds a plain-text version with links spelled out", () => {
    expect(htmlToText('<p>Hello <a href="https://x.test">there</a></p><ul><li>one</li></ul>')).toBe(
      "Hello there (https://x.test)\n\n• one"
    );
  });
});
