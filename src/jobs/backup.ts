import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink } from "node:fs/promises";
import { gzip } from "node:zlib";
import cron from "node-cron";
import { env } from "@/config/env";
import { uploadToBlobStorage } from "@/lib/blob-storage";

const execAsync = promisify(exec);
const gzipAsync = promisify(gzip);

export async function runBackup(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = `/tmp/radhakundah-${timestamp}.sql`;

  try {
    await execAsync(`pg_dump "${env.DATABASE_URL}" -f "${dumpPath}"`);

    const dump = await readFile(dumpPath);
    const compressed = await gzipAsync(dump);

    await uploadToBlobStorage(
      "backup",
      `radhakundah-${timestamp}.sql.gz`,
      compressed,
      "application/gzip"
    );

    await unlink(dumpPath);

    console.log(`Backup completed: radhakundah-${timestamp}.sql.gz`);
  } catch (error) {
    console.error("Backup failed:", error);
    await unlink(dumpPath).catch(() => {});
  }
}

export function scheduleBackup(): void {
  if (!env.BACKUP_ENABLED) {
    return;
  }

  cron.schedule(env.BACKUP_CRON, runBackup);
  console.log(`Backup scheduled: ${env.BACKUP_CRON}`);
}
