import nodemailer from "nodemailer";
import { env } from "@/config/env";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: Array.isArray(options.to) ? options.to.join(",") : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });
  } catch (error) {
    console.error("Email send error:", error);
    throw error;
  }
}

export async function sendContactNotification(
  name: string,
  email: string,
  subject: string,
  message: string,
  phone?: string
): Promise<void> {
  const html = `
    <h2>New Contact Message</h2>
    <p><strong>From:</strong> ${name} (${email})</p>
    ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, "<br>")}</p>
  `;

  await sendEmail({
    to: env.CONTACT_NOTIFY_TO,
    subject: `New Contact: ${subject}`,
    html,
    replyTo: email,
  });
}
