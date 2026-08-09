import { z } from "zod";

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

  S3_REGION: z.string(),
  S3_BUCKET_PUBLIC: z.string(),
  S3_BUCKET_PRIVATE: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_PUBLIC_BASE_URL: z.string().url(),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(60),

  BACKUP_ENABLED: z.string().transform((v) => v === "true").default("true"),
  BACKUP_CRON: z.string().default("0 2 */3 * *"),
  BACKUP_S3_BUCKET: z.string(),
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
