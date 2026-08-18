import { PrismaClient, HeroSlide } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { CreateSlideInput, UpdateSlideInput } from "./hero.schema";

class HeroService {
  async createSlide(prisma: PrismaClient, data: CreateSlideInput): Promise<HeroSlide> {
    return prisma.heroSlide.create({
      data: {
        title: data.title,
        subtitle: data.subtitle,
        imageId: data.imageId,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        order: data.order,
        isActive: data.isActive,
      },
      include: { image: true },
    });
  }

  async listSlides(prisma: PrismaClient, activeOnly = true) {
    return prisma.heroSlide.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { order: "asc" },
      include: { image: true },
    });
  }

  async updateSlide(
    prisma: PrismaClient,
    id: string,
    data: UpdateSlideInput
  ): Promise<HeroSlide> {
    const slide = await prisma.heroSlide.findUnique({ where: { id } });

    if (!slide) {
      throw new NotFoundError("Hero slide not found");
    }

    return prisma.heroSlide.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        subtitle: data.subtitle,
        ...(data.imageId && { imageId: data.imageId }),
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        ...(data.order !== undefined && { order: data.order }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { image: true },
    });
  }

  async deleteSlide(prisma: PrismaClient, id: string): Promise<void> {
    const slide = await prisma.heroSlide.findUnique({ where: { id } });

    if (!slide) {
      throw new NotFoundError("Hero slide not found");
    }

    await prisma.heroSlide.delete({ where: { id } });
  }
}

export default new HeroService();
