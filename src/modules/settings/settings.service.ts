import { PrismaClient, Setting } from "@prisma/client";

const PUBLIC_SETTING_PREFIXES = ["site.", "contact.", "social.", "analytics.", "seo."];

class SettingsService {
  async getAll(prisma: PrismaClient): Promise<Record<string, any>> {
    const settings = await prisma.setting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }

  async getPublic(prisma: PrismaClient): Promise<Record<string, any>> {
    const settings = await prisma.setting.findMany();
    return Object.fromEntries(
      settings
        .filter((s) => PUBLIC_SETTING_PREFIXES.some((p) => s.key.startsWith(p)))
        .map((s) => [s.key, s.value])
    );
  }

  async upsertMany(
    prisma: PrismaClient,
    entries: Record<string, any>
  ): Promise<Setting[]> {
    return prisma.$transaction(
      Object.entries(entries).map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );
  }
}

export default new SettingsService();
