import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Seed super admin
  const superAdmin = await prisma.user.upsert({
    where: { email: env.SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: env.SUPER_ADMIN_EMAIL,
      name: env.SUPER_ADMIN_NAME,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      isProtected: true,
      provider: "GOOGLE",
    },
  });
  console.log(`✓ Super admin: ${superAdmin.email}`);

  // Seed default categories for ARTICLE
  const articleCats = ["Technology", "Business", "Culture", "Science"];
  for (const cat of articleCats) {
    await prisma.category.upsert({
      where: { scope_slug: { scope: "ARTICLE", slug: cat.toLowerCase() } },
      update: {},
      create: {
        scope: "ARTICLE",
        name: cat,
        slug: cat.toLowerCase(),
      },
    });
  }
  console.log(`✓ Article categories seeded`);

  // Seed default categories for BLOG
  const blogCats = ["Updates", "Announcements", "Learning", "Stories"];
  for (const cat of blogCats) {
    await prisma.category.upsert({
      where: { scope_slug: { scope: "BLOG", slug: cat.toLowerCase() } },
      update: {},
      create: {
        scope: "BLOG",
        name: cat,
        slug: cat.toLowerCase(),
      },
    });
  }
  console.log(`✓ Blog categories seeded`);

  // Seed default categories for RESEARCH
  const researchCats = ["Study", "Report", "Analysis", "Review"];
  for (const cat of researchCats) {
    await prisma.category.upsert({
      where: { scope_slug: { scope: "RESEARCH", slug: cat.toLowerCase() } },
      update: {},
      create: {
        scope: "RESEARCH",
        name: cat,
        slug: cat.toLowerCase(),
      },
    });
  }
  console.log(`✓ Research categories seeded`);

  // Seed default video categories
  const videoCats = ["Lectures", "Tutorials", "Documentaries", "Interviews"];
  for (const cat of videoCats) {
    await prisma.videoCategory.upsert({
      where: { slug: cat.toLowerCase() },
      update: {},
      create: {
        name: cat,
        slug: cat.toLowerCase(),
      },
    });
  }
  console.log(`✓ Video categories seeded`);

  // Seed site settings
  const settings = {
    "site.title": "Radhakundah",
    "site.description": "Research Publications, Articles, and Multimedia Hub",
    "seo.defaultOgImage": "",
    "contact.email": env.CONTACT_NOTIFY_TO,
    "contact.phone": "",
    "contact.address": "",
    "social.twitter": "",
    "social.facebook": "",
    "social.linkedin": "",
    "social.instagram": "",
    "analytics.ga4": "",
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log(`✓ Settings seeded`);

  // Seed about page
  await prisma.page.upsert({
    where: { key: "about" },
    update: {},
    create: {
      key: "about",
      title: "About Us",
      sections: {
        about: "Welcome to Radhakundah",
        mission: "Our mission is to advance knowledge",
        vision: "Our vision is a connected global community",
        objectives: ["Objective 1", "Objective 2"],
        team: [],
        journey: [],
        contact: "Contact us for more information",
      },
    },
  });
  console.log(`✓ About page seeded`);

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
