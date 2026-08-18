import { PrismaClient, Category, CategoryScope } from "@prisma/client";
import { generateUniqueSlug } from "@/lib/slug";
import { NotFoundError } from "@/lib/errors";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

class CategoriesService {
  async createCategory(
    prisma: PrismaClient,
    scope: CategoryScope,
    data: CreateCategoryInput
  ): Promise<Category> {
    const slug = data.slug || (await generateUniqueSlug(prisma, data.name, "category"));

    return prisma.category.create({
      data: {
        scope,
        name: data.name,
        slug,
        description: data.description,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        noIndex: data.noIndex,
      },
    });
  }

  async getCategory(prisma: PrismaClient, id: string): Promise<Category> {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  }

  async listCategories(
    prisma: PrismaClient,
    scope: CategoryScope,
    skip: number = 0,
    take: number = 50
  ): Promise<{ categories: Category[]; total: number }> {
    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where: { scope },
        skip,
        take,
        orderBy: { order: "asc" },
      }),
      prisma.category.count({ where: { scope } }),
    ]);

    return { categories, total };
  }

  async updateCategory(
    prisma: PrismaClient,
    id: string,
    data: UpdateCategoryInput
  ): Promise<Category> {
    await this.getCategory(prisma, id);

    return prisma.category.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        description: data.description,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ...(data.noIndex !== undefined && { noIndex: data.noIndex }),
      },
    });
  }

  async deleteCategory(prisma: PrismaClient, id: string): Promise<void> {
    await this.getCategory(prisma, id);

    await prisma.category.delete({
      where: { id },
    });
  }
}

export default new CategoriesService();
