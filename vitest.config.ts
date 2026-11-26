import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // src/config/env.ts validates the whole environment at import time.
    env: {
      NODE_ENV: "test",
      API_URL: "https://api.example.test",
      SITE_URL: "https://site.example.test",
      DATABASE_URL: "postgresql://test@localhost/test",
      JWT_ACCESS_SECRET: "test-secret-test-secret-test-secret-123",
      GOOGLE_CLIENT_ID: "x",
      GOOGLE_CLIENT_SECRET: "x",
      GOOGLE_CALLBACK_URL: "https://api.example.test/cb",
      SUPER_ADMIN_EMAIL: "admin@example.test",
      SUPER_ADMIN_NAME: "Admin",
      SMTP_USER: "x",
      SMTP_PASS: "x",
      CONTACT_NOTIFY_TO: "contact@example.test",
      AZURE_STORAGE_ACCOUNT_NAME: "x",
      AZURE_STORAGE_ACCOUNT_KEY: "x",
      AZURE_STORAGE_CONTAINER_PUBLIC: "x",
      AZURE_STORAGE_CONTAINER_PRIVATE: "x",
      AZURE_STORAGE_CONTAINER_BACKUP: "x",
    },
  },
});
