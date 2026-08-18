import { OAuth2Client } from "google-auth-library";
import { env } from "@/config/env";

const client = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_CALLBACK_URL,
});

export interface GoogleProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

export function getGoogleAuthUrl(): string {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const url = client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return url;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
}> {
  try {
    const { tokens } = await client.getToken(code);

    return {
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || null,
    };
  } catch (error) {
    console.error("Failed to exchange code:", error);
    throw error;
  }
}

export async function getGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch Google profile");
    }

    const data = await response.json();

    return {
      sub: data.id,
      name: data.name,
      email: data.email,
      picture: data.picture,
    };
  } catch (error) {
    console.error("Failed to fetch Google profile:", error);
    throw error;
  }
}
