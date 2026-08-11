import { PrismaClient, Author } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slug";
import { NotFoundError } from "@/lib/errors";
import { CreateAuthorInput, UpdateAuthorInput } from "./authors.schema";

class AuthorsService {
  async createAuthor(prisma: PrismaClient, data: CreateAuthorInput): Promise<Author> {
    const slug = data.slug || (await generateUniqueSlug(prisma, data.name, "author"));

    return prisma.author.create({
      data: {
        name: data.name,
        slug,
        affiliation: data.affiliation,
        bio: data.bio,
        photoId: data.photoId,
        email: data.email,
        orcid: data.orcid,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        noIndex: data.noIndex,
      },
    });
  }

  async getAuthor(prisma: PrismaClient, id: string) {
    const author = await prisma.author.findUnique({
      where: { id },
      include: { photo: true },
    });

    if (!author) {
      throw new NotFoundError("Author not found");
    }

    return author;
  }

  async getAuthorBySlug(prisma: PrismaClient, slug: string) {
    const author = await prisma.author.findUnique({
      where: { slug },
      include: {
        photo: true,
        research: {
          include: { research: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!author) {
      throw new NotFoundError("Author not found");
    }

    return author;
  }

  async listAuthors(prisma: PrismaClient, skip = 0, take = 50) {
    const [authors, total] = await Promise.all([
      prisma.author.findMany({
        skip,
        take,
        orderBy: { name: "asc" },
        include: { photo: true },
      }),
      prisma.author.count(),
    ]);

    return { authors, total };
  }

  async updateAuthor(
    prisma: PrismaClient,
    id: string,
    data: UpdateAuthorInput
  ): Promise<Author> {
    await this.getAuthor(prisma, id);

    return prisma.author.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        affiliation: data.affiliation,
        bio: data.bio,
        photoId: data.photoId,
        email: data.email,
        orcid: data.orcid,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      },
    });
  }

  async deleteAuthor(prisma: PrismaClient, id: string): Promise<void> {
    await this.getAuthor(prisma, id);

    await prisma.author.delete({ where: { id } });
  }
}

export default new AuthorsService();
