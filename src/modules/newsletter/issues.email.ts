/**
 * The email form of a newsletter issue. Pure functions, no I/O, so the markup
 * can be unit-tested and previewed without SMTP.
 *
 * Email clients ignore most CSS, so the layout is a single centred table with
 * inline styles. The issue body is the same sanitised HTML the website shows.
 */

export interface IssueEmailInput {
  title: string;
  subtitle?: string | null;
  content: string;
  excerpt?: string | null;
  slug: string;
  publishedAt?: Date | null;
  coverImageUrl?: string | null;
  authorName?: string | null;
}

export interface IssueEmailContext {
  siteName: string;
  siteUrl: string;
  /** Page that unsubscribes this recipient. Omitted for test sends. */
  unsubscribeUrl?: string;
  /** API endpoint for RFC 8058 one-click unsubscribe. Omitted for test sends. */
  oneClickUnsubscribeUrl?: string;
  /** Prefix the subject, e.g. "[Test]". */
  subjectPrefix?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

const BRAND = "#ef9f00";
const INK = "#2b2118";
const MUTED = "#7a6d60";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Readable plain-text fallback from the issue HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr|pre)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Inline styles the elements clients would otherwise render unstyled or oversized. */
function styleBody(html: string): string {
  return html
    .replace(/<img\s/gi, '<img style="max-width:100%;height:auto;border:0;display:block;margin:16px 0;" ')
    .replace(/<a\s/gi, `<a style="color:${BRAND};" `)
    .replace(
      /<blockquote(\s[^>]*)?>/gi,
      `<blockquote style="margin:16px 0;padding:4px 0 4px 16px;border-left:3px solid ${BRAND};color:${MUTED};">`
    )
    .replace(/<h2(\s[^>]*)?>/gi, `<h2 style="font-size:22px;line-height:1.3;margin:28px 0 8px;color:${INK};">`)
    .replace(/<h3(\s[^>]*)?>/gi, `<h3 style="font-size:18px;line-height:1.3;margin:24px 0 8px;color:${INK};">`);
}

export function issueUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, "")}/newsletter/${encodeURIComponent(slug)}`;
}

export function renderIssueEmail(issue: IssueEmailInput, ctx: IssueEmailContext): RenderedEmail {
  const webUrl = issueUrl(ctx.siteUrl, issue.slug);
  const subject = `${ctx.subjectPrefix ? `${ctx.subjectPrefix} ` : ""}${issue.title}`;
  const dateLine = issue.publishedAt
    ? issue.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "";
  const byline = [issue.authorName, dateLine].filter(Boolean).join(" · ");
  const preheader = issue.subtitle || issue.excerpt || "";

  const footerLinks = [
    `<a href="${escapeHtml(webUrl)}" style="color:${MUTED};">Read on the website</a>`,
    ctx.unsubscribeUrl
      ? `<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a>`
      : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(issue.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f1ea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1ea;">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:6px;">
<tr><td style="padding:28px 32px 0;font-family:Georgia,'Times New Roman',serif;">
<a href="${escapeHtml(ctx.siteUrl)}" style="color:${BRAND};text-decoration:none;font-size:14px;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(ctx.siteName)}</a>
</td></tr>
<tr><td style="padding:20px 32px 0;font-family:Georgia,'Times New Roman',serif;color:${INK};">
<h1 style="font-size:30px;line-height:1.2;margin:0;">${escapeHtml(issue.title)}</h1>
${issue.subtitle ? `<p style="font-size:18px;line-height:1.45;color:${MUTED};margin:10px 0 0;">${escapeHtml(issue.subtitle)}</p>` : ""}
${byline ? `<p style="font-size:13px;color:${MUTED};margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(byline)}</p>` : ""}
</td></tr>
${
  issue.coverImageUrl
    ? `<tr><td style="padding:20px 32px 0;"><img src="${escapeHtml(issue.coverImageUrl)}" alt="" width="536" style="width:100%;max-width:536px;height:auto;border:0;display:block;border-radius:4px;"></td></tr>`
    : ""
}
<tr><td style="padding:20px 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.65;color:${INK};">
${styleBody(issue.content)}
</td></tr>
<tr><td style="padding:8px 32px 28px;">
<a href="${escapeHtml(webUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;padding:10px 20px;border-radius:999px;">Read on the website</a>
</td></tr>
</table>
<p style="max-width:600px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${MUTED};margin:18px auto 0;">
You are receiving this because you subscribed to the ${escapeHtml(ctx.siteName)} newsletter.<br>
${footerLinks}
</p>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    issue.title,
    issue.subtitle || "",
    byline,
    "",
    htmlToText(issue.content),
    "",
    `Read on the website: ${webUrl}`,
    ctx.unsubscribeUrl ? `Unsubscribe: ${ctx.unsubscribeUrl}` : "",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();

  const headers: Record<string, string> = {};
  if (ctx.oneClickUnsubscribeUrl || ctx.unsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${ctx.oneClickUnsubscribeUrl || ctx.unsubscribeUrl}>`;
  }
  if (ctx.oneClickUnsubscribeUrl) {
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return { subject, html, text, headers };
}
