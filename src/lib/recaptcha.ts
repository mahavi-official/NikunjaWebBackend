import { env } from "@/config/env";
import { ValidationFailedError } from "@/lib/errors";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const TIMEOUT_MS = 5000;

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  "error-codes"?: string[];
}

/**
 * Verifies a reCAPTCHA token against Google, but only when a secret is
 * configured — local development and self-hosted installs without a key keep
 * working on the honeypot alone.
 *
 * Google being slow or unreachable must not take the contact form down with
 * it, so a network failure is logged and allowed through; the honeypot and the
 * per-IP rate limit still apply. A token that Google actively rejects is a
 * different matter and is refused.
 */
export async function verifyRecaptcha(token: string | undefined, ip: string): Promise<void> {
  if (!env.RECAPTCHA_SECRET) return;

  if (!token) {
    throw new ValidationFailedError("Captcha verification required");
  }

  let result: SiteVerifyResponse;
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.RECAPTCHA_SECRET, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`reCAPTCHA verification returned HTTP ${response.status}; allowing submission`);
      return;
    }

    result = (await response.json()) as SiteVerifyResponse;
  } catch (error) {
    console.error("reCAPTCHA verification unreachable; allowing submission:", error);
    return;
  }

  if (!result.success) {
    throw new ValidationFailedError("Captcha verification failed");
  }
}
