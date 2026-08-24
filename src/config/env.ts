import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().url(),
  SITE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_DOMAIN: z.string().default(".radhakundah.com"),
  COOKIE_SECURE: z.string().transform((v) => v === "true").default("true"),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url(),

  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_NAME: z.string(),

  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  MAIL_FROM: z.string().default("Radhakundah <no-reply@radhakundah.com>"),
  CONTACT_NOTIFY_TO: z.string().email(),

  AZURE_STORAGE_ACCOUNT_NAME: z.string(),
  AZURE_STORAGE_ACCOUNT_KEY: z.string(),
  AZURE_STORAGE_CONTAINER_PUBLIC: z.string(),
  AZURE_STORAGE_CONTAINER_PRIVATE: z.string(),
  AZURE_STORAGE_CONTAINER_BACKUP: z.string(),
  /**
   * Override the blob endpoint — e.g. a custom domain, or Azurite in local dev.
   * Optional, so a present-but-blank line is treated the same as an absent one.
   */
  AZURE_STORAGE_BLOB_ENDPOINT: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
  /**
   * Optional CDN or custom domain in front of the public container. It must
   * address that container (i.e. end in `/<AZURE_STORAGE_CONTAINER_PUBLIC>`
   * unless the domain is already rooted there). Leave it unset to serve blobs
   * straight from the storage account, which `blob-storage.ts` derives from
   * the endpoint and container the upload actually used.
   */
  AZURE_BLOB_PUBLIC_BASE_URL: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().url().optional()
  ),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(60),

  BACKUP_ENABLED: z.string().transform((v) => v === "true").default("true"),
  BACKUP_CRON: z.string().default("0 2 */3 * *"),
  BACKUP_RETENTION_DAYS: z.coerce.number().default(90),

  RECAPTCHA_SECRET: z.string().optional().default(""),
  PREVIEW_TOKEN_TTL_MINUTES: z.coerce.number().default(30),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    parsed.error.errors.forEach((err) => {
      console.error(`  ${err.path.join(".")}: ${err.message}`);
    });
    process.exit(1);
  }

  console.log("✓ Environment variables validated");
  return parsed.data;
}

export const env = validateEnv();
