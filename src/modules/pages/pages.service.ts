import { PrismaClient, Page } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { UpsertPageInput } from "./pages.schema";

class PagesService {
  async getPage(prisma: PrismaClient, key: string): Promise<Page> {
    const page = await prisma.page.findUnique({ where: { key } });

    if (!page) {
      throw new NotFoundError("Page not found");
    }

    return page;
  }

  async upsertPage(
    prisma: PrismaClient,
    key: string,
    data: UpsertPageInput
  ): Promise<Page> {
    return prisma.page.upsert({
      where: { key },
      update: {
        title: data.title,
        sections: data.sections,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ogImageId: data.ogImageId,
        noIndex: data.noIndex,
      },
      create: {
        key,
        title: data.title,
        sections: data.sections,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ogImageId: data.ogImageId,
        noIndex: data.noIndex,
      },
    });
  }
}

export default new PagesService();
