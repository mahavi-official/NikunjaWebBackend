import { PrismaClient, Tag } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slug";
import { NotFoundError } from "@/lib/errors";
import { CreateTagInput, UpdateTagInput } from "./tags.schema";

class TagsService {
  async createTag(prisma: PrismaClient, data: CreateTagInput): Promise<Tag> {
    const slug = data.slug || (await generateUniqueSlug(prisma, data.name, "tag"));

    return prisma.tag.create({
      data: {
        name: data.name,
        slug,
      },
    });
  }

  async getTag(prisma: PrismaClient, id: string): Promise<Tag> {
    const tag = await prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw new NotFoundError("Tag not found");
    }

    return tag;
  }

  async listTags(
    prisma: PrismaClient,
    skip: number = 0,
    take: number = 50
  ): Promise<{ tags: Tag[]; total: number }> {
    const [tags, total] = await Promise.all([
      prisma.tag.findMany({
        skip,
        take,
        orderBy: { name: "asc" },
      }),
      prisma.tag.count(),
    ]);

    return { tags, total };
  }

  async updateTag(
    prisma: PrismaClient,
    id: string,
    data: UpdateTagInput
  ): Promise<Tag> {
    await this.getTag(prisma, id);

    return prisma.tag.update({
      where: { id },
      data: { name: data.name },
    });
  }

  async deleteTag(prisma: PrismaClient, id: string): Promise<void> {
    await this.getTag(prisma, id);

    await prisma.tag.delete({ where: { id } });
  }

  async findOrCreateTags(prisma: PrismaClient, names: string[]): Promise<Tag[]> {
    const tags: Tag[] = [];

    for (const name of names) {
      let tag = await prisma.tag.findUnique({ where: { name } });

      if (!tag) {
        const slug = await generateUniqueSlug(prisma, name, "tag");
        tag = await prisma.tag.create({ data: { name, slug } });
      }

      tags.push(tag);
    }

    return tags;
  }
}

export default new TagsService();
