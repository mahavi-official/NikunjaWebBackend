import { PrismaClient, Prisma } from "@prisma/client";
import {
  SEED_MEDIA_PREFIX,
  SEED_USER_EMAIL_DOMAIN,
  aboutPageSeed,
  auditLogSeed,
  authorsSeed,
  categoriesSeed,
  commentsSeed,
  contactMessagesSeed,
  gallerySeed,
  heroSeed,
  likesSeed,
  mediaSeed,
  memberUsersSeed,
  postsSeed,
  redirectsSeed,
  researchSeed,
  settingsSeed,
  subscribersSeed,
  tagSlug,
  tagsSeed,
  videoCategoriesSeed,
  videosSeed,
} from "./data";

/**
 * Rows the seed owns carry a `seed-` id or a `seed/` storage key wherever the
 * table has no natural unique column. That prefix is the only thing `clean`
 * matches on, so hand-made rows are never at risk.
 */
const SEED_ID = "seed-";

const seedId = (...parts: Array<string | number>) => `${SEED_ID}${parts.join("-")}`;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

const picsum = (key: string, width: number, height: number, ext = "jpg") =>
  `https://picsum.photos/seed/${key}/${width}/${height}.${ext}`;

type Log = (message: string) => void;

// ═══════════════════════════════════════════════════════════════
// SEED
// ═══════════════════════════════════════════════════════════════

export async function seedContent(prisma: PrismaClient, log: Log): Promise<void> {
  // ── media ──────────────────────────────────────────────────────
  const mediaIds = new Map<string, string>();
  const mediaUrls = new Map<string, string>();

  for (const item of mediaSeed) {
    const blobName = `${SEED_MEDIA_PREFIX}${item.folder.replace(/^\//, "")}/${item.fileName}`;
    const url = picsum(item.key, item.width, item.height);
    const variants: Prisma.InputJsonValue = {
      thumb: { webp: picsum(item.key, 200, 200, "webp"), original: picsum(item.key, 200, 200) },
      medium: { webp: picsum(item.key, 600, 400, "webp"), original: picsum(item.key, 600, 400) },
      large: { webp: picsum(item.key, 1200, 800, "webp"), original: picsum(item.key, 1200, 800) },
      og: { webp: picsum(item.key, 1200, 630, "webp"), original: picsum(item.key, 1200, 630) },
    };
    const fields = {
      url,
      fileName: item.fileName,
      mimeType: "image/jpeg",
      sizeBytes: Math.round((item.width * item.height) / 8),
      width: item.width,
      height: item.height,
      alt: item.alt,
      folder: item.folder,
      variants,
    };

    const row = await prisma.media.upsert({
      where: { blobName },
      update: fields,
      create: { blobName, ...fields },
    });
    mediaIds.set(item.key, row.id);
    mediaUrls.set(item.key, row.url);
  }
  log(`media ................. ${mediaSeed.length}`);

  const mediaId = (key: string): string => {
    const id = mediaIds.get(key);
    if (!id) throw new Error(`Seed data references unknown media key "${key}"`);
    return id;
  };

  // ── categories & tags ──────────────────────────────────────────
  const categoryIds = new Map<string, string>();

  for (const cat of categoriesSeed) {
    const row = await prisma.category.upsert({
      where: { scope_slug: { scope: cat.scope, slug: cat.slug } },
      update: { name: cat.name, description: cat.description, order: cat.order },
      create: {
        scope: cat.scope,
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        order: cat.order,
      },
    });
    // Category slugs are unique per scope in the database, but content here
    // refers to them by slug alone — so the seed data must not reuse one slug
    // in two scopes, or posts would silently land in the wrong category.
    if (categoryIds.has(cat.slug)) {
      throw new Error(
        `Category slug "${cat.slug}" is used in more than one scope in the seed data. ` +
          "Give each seeded category a slug of its own."
      );
    }
    categoryIds.set(cat.slug, row.id);
  }
  log(`categories ............ ${categoriesSeed.length}`);

  const videoCategoryIds = new Map<string, string>();
  for (const cat of videoCategoriesSeed) {
    const row = await prisma.videoCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, order: cat.order },
      create: { slug: cat.slug, name: cat.name, description: cat.description, order: cat.order },
    });
    videoCategoryIds.set(cat.slug, row.id);
  }
  log(`video categories ...... ${videoCategoriesSeed.length}`);

  const tagIds = new Map<string, string>();
  for (const name of tagsSeed) {
    const slug = tagSlug(name);
    const row = await prisma.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    tagIds.set(name, row.id);
  }
  log(`tags .................. ${tagsSeed.length}`);

  const tagId = (name: string): string => {
    const id = tagIds.get(name);
    if (!id) throw new Error(`Seed data references unknown tag "${name}"`);
    return id;
  };

  const categoryId = (slug: string): string => {
    const id = categoryIds.get(slug);
    if (!id) throw new Error(`Seed data references unknown category "${slug}"`);
    return id;
  };

  // ── authoring account ──────────────────────────────────────────
  // Posts need a User as author. The super admin already exists (the server
  // creates it at boot), and the seed does not create or modify staff accounts.
  const staffAuthor =
    (await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN", "EDITOR"] } },
      orderBy: { createdAt: "asc" },
    })) ?? null;

  if (!staffAuthor) {
    throw new Error(
      "No staff account found to attribute posts to. Start the API once (it creates the " +
        "super admin at boot) or check SUPER_ADMIN_EMAIL, then run this seed again."
    );
  }

  // ── posts ──────────────────────────────────────────────────────
  const postIds = new Map<string, string>();

  for (const post of postsSeed) {
    const publishedAt = post.publishedDaysAgo === null ? null : daysAgo(post.publishedDaysAgo);
    const fields = {
      title: post.title,
      placement: post.placement,
      status: (publishedAt ? "PUBLISHED" : "DRAFT") as "PUBLISHED" | "DRAFT",
      publishedAt,
      excerpt: post.excerpt,
      content: post.content,
      coverImageId: mediaId(post.coverKey),
      ogImageId: mediaId(post.coverKey),
      authorId: staffAuthor.id,
      isFeatured: post.isFeatured,
      viewCount: post.viewCount,
      commentsEnabled: post.commentsEnabled,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      metaKeywords: post.tagNames.join(", "),
    };

    const row = await prisma.post.upsert({
      where: { slug: post.slug },
      update: fields,
      create: { slug: post.slug, ...fields },
    });
    postIds.set(post.slug, row.id);

    // Join rows are rewritten rather than diffed — cheap at this size, and it
    // keeps a re-run faithful to whatever the seed data now says.
    await prisma.postCategory.deleteMany({ where: { postId: row.id } });
    await prisma.postCategory.createMany({
      data: post.categorySlugs.map((slug) => ({ postId: row.id, categoryId: categoryId(slug) })),
      skipDuplicates: true,
    });

    await prisma.postTag.deleteMany({ where: { postId: row.id } });
    await prisma.postTag.createMany({
      data: post.tagNames.map((name) => ({ postId: row.id, tagId: tagId(name) })),
      skipDuplicates: true,
    });
  }
  const publishedPosts = postsSeed.filter((p) => p.publishedDaysAgo !== null && p.publishedDaysAgo > 0);
  log(
    `posts ................. ${postsSeed.length} (${publishedPosts.length} live, ` +
      `1 draft, 1 scheduled)`
  );

  // ── authors ────────────────────────────────────────────────────
  const authorIds = new Map<string, string>();
  for (const author of authorsSeed) {
    const fields = {
      name: author.name,
      affiliation: author.affiliation,
      bio: author.bio,
      email: author.email,
      orcid: author.orcid,
      photoId: mediaId(author.photoKey),
      metaTitle: `${author.name} — publications`,
      metaDescription: author.bio.slice(0, 155),
    };
    const row = await prisma.author.upsert({
      where: { slug: author.slug },
      update: fields,
      create: { slug: author.slug, ...fields },
    });
    authorIds.set(author.slug, row.id);
  }
  log(`authors ............... ${authorsSeed.length}`);

  // ── research ───────────────────────────────────────────────────
  for (const paper of researchSeed) {
    const publishedAt = paper.publishedDaysAgo === null ? null : daysAgo(paper.publishedDaysAgo);
    const fields = {
      title: paper.title,
      abstract: paper.abstract,
      categoryId: categoryId(paper.categorySlug),
      status: (publishedAt ? "PUBLISHED" : "DRAFT") as "PUBLISHED" | "DRAFT",
      publishedAt,
      isFeatured: paper.isFeatured,
      viewCount: paper.viewCount,
      doi: paper.doi || null,
      journal: paper.journal || null,
      volume: paper.volume || null,
      issue: paper.issue || null,
      pages: paper.pages || null,
      publicationYear: paper.publicationYear,
      keywords: paper.keywords,
      ogImageId: mediaId(paper.ogImageKey),
      metaTitle: paper.title.slice(0, 60),
      metaDescription: paper.abstract.slice(0, 155),
      extractedText: paper.extractedText,
    };

    const row = await prisma.research.upsert({
      where: { slug: paper.slug },
      update: fields,
      create: { slug: paper.slug, ...fields },
    });

    await prisma.researchAuthor.deleteMany({ where: { researchId: row.id } });
    await prisma.researchAuthor.createMany({
      data: paper.authors.map(([slug, isCorresponding], order) => {
        const id = authorIds.get(slug);
        if (!id) throw new Error(`Seed data references unknown author "${slug}"`);
        return { researchId: row.id, authorId: id, order, isCorresponding };
      }),
      skipDuplicates: true,
    });

    await prisma.researchTag.deleteMany({ where: { researchId: row.id } });
    await prisma.researchTag.createMany({
      data: paper.tagNames.map((name) => ({ researchId: row.id, tagId: tagId(name) })),
      skipDuplicates: true,
    });

    // Metadata only. No PDF is uploaded, so the gated download endpoint will
    // sign blob names that do not exist — see the note printed at the end of the run.
    await prisma.researchFile.deleteMany({ where: { researchId: row.id } });
    await prisma.researchFile.create({
      data: {
        researchId: row.id,
        label: paper.fileLabel,
        blobName: `${SEED_MEDIA_PREFIX}research/${paper.slug}.pdf`,
        fileName: `${paper.slug}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: paper.fileSizeBytes,
        pageCount: paper.filePages,
        order: 0,
      },
    });
  }
  log(`research .............. ${researchSeed.length} (${researchSeed.length - 1} live, 1 draft)`);

  // ── videos ─────────────────────────────────────────────────────
  for (const video of videosSeed) {
    const publishedAt = video.publishedDaysAgo === null ? null : daysAgo(video.publishedDaysAgo);
    const fields = {
      title: video.title,
      description: video.description,
      youtubeId: video.youtubeId,
      // hqdefault, not maxresdefault: YouTube only generates the latter for
      // sources shot above 720p, so it 404s on plenty of real videos.
      thumbnailUrl: `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
      durationSec: video.durationSec,
      categoryId: videoCategoryIds.get(video.categorySlug) ?? null,
      status: (publishedAt ? "PUBLISHED" : "DRAFT") as "PUBLISHED" | "DRAFT",
      publishedAt,
      isFeatured: video.isFeatured,
      viewCount: video.viewCount,
      metaTitle: video.title,
      metaDescription: video.description.slice(0, 155),
    };
    await prisma.video.upsert({
      where: { slug: video.slug },
      update: fields,
      create: { slug: video.slug, ...fields },
    });
  }
  log(`videos ................ ${videosSeed.length} (${videosSeed.length - 1} live, 1 draft)`);

  // ── gallery ────────────────────────────────────────────────────
  let galleryImageCount = 0;
  for (const segment of gallerySeed) {
    const fields = {
      name: segment.name,
      description: segment.description,
      coverImageId: mediaId(segment.coverKey),
      order: segment.order,
      isPublished: segment.isPublished,
      metaTitle: segment.name,
      metaDescription: segment.description.slice(0, 155),
    };
    const row = await prisma.gallerySegment.upsert({
      where: { slug: segment.slug },
      update: fields,
      create: { slug: segment.slug, ...fields },
    });

    await prisma.galleryImage.deleteMany({ where: { segmentId: row.id } });
    await prisma.galleryImage.createMany({
      data: segment.images.map((image, order) => ({
        segmentId: row.id,
        mediaId: mediaId(image.mediaKey),
        alt: mediaSeed.find((m) => m.key === image.mediaKey)?.alt ?? image.caption,
        caption: image.caption,
        order,
      })),
    });
    galleryImageCount += segment.images.length;
  }
  log(`gallery ............... ${gallerySeed.length} segments, ${galleryImageCount} images`);

  // ── hero slides ────────────────────────────────────────────────
  for (const [index, slide] of heroSeed.entries()) {
    const fields = {
      title: slide.title,
      subtitle: slide.subtitle,
      imageId: mediaId(slide.imageKey),
      ctaLabel: slide.ctaLabel || null,
      ctaUrl: slide.ctaUrl || null,
      order: slide.order,
      isActive: slide.isActive,
    };
    await prisma.heroSlide.upsert({
      where: { id: seedId("hero", index) },
      update: fields,
      create: { id: seedId("hero", index), ...fields },
    });
  }
  log(`hero slides ........... ${heroSeed.length} (${heroSeed.filter((h) => h.isActive).length} active)`);

  // ── settings & about page ──────────────────────────────────────
  const settings: Record<string, unknown> = {
    ...settingsSeed,
    "site.logo": mediaUrls.get("site-logo") ?? "",
    "seo.defaultOgImage": mediaUrls.get("seo-default-og") ?? "",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
  log(`settings .............. ${Object.keys(settings).length}`);

  const pageFields = {
    title: aboutPageSeed.title,
    sections: aboutPageSeed.sections as Prisma.InputJsonValue,
    metaTitle: aboutPageSeed.metaTitle,
    metaDescription: aboutPageSeed.metaDescription,
    ogImageId: mediaId("seo-default-og"),
  };
  await prisma.page.upsert({
    where: { key: aboutPageSeed.key },
    update: pageFields,
    create: { key: aboutPageSeed.key, ...pageFields },
  });
  log(`pages ................. 1 (about)`);

  // ── members, comments, likes ───────────────────────────────────
  const memberIds: string[] = [];
  for (const member of memberUsersSeed) {
    const row = await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name },
      create: {
        email: member.email,
        name: member.name,
        role: "MEMBER",
        status: "ACTIVE",
        provider: "GOOGLE",
        lastLoginAt: daysAgo(1),
      },
    });
    memberIds.push(row.id);
  }
  log(`member accounts ....... ${memberUsersSeed.length}`);

  const postId = (slug: string): string => {
    const id = postIds.get(slug);
    if (!id) throw new Error(`Seed data references unknown post "${slug}"`);
    return id;
  };

  for (const [index, comment] of commentsSeed.entries()) {
    const fields = {
      postId: postId(comment.postSlug),
      userId: memberIds[comment.memberIndex]!,
      body: comment.body,
      isHidden: comment.isHidden,
      createdAt: daysAgo(comment.daysAgo),
    };
    await prisma.comment.upsert({
      where: { id: seedId("comment", index) },
      update: fields,
      create: { id: seedId("comment", index), ...fields },
    });
  }
  log(`comments .............. ${commentsSeed.length} (1 hidden)`);

  await prisma.like.createMany({
    data: likesSeed.map(([slug, memberIndex]) => ({
      postId: postId(slug),
      userId: memberIds[memberIndex]!,
    })),
    skipDuplicates: true,
  });
  log(`likes ................. ${likesSeed.length}`);

  // ── inbox, newsletter, redirects, audit ────────────────────────
  for (const [index, message] of contactMessagesSeed.entries()) {
    const fields = {
      name: message.name,
      email: message.email,
      phone: message.phone || null,
      subject: message.subject || null,
      message: message.message,
      ip: "203.0.113.10",
      isRead: message.isRead,
      createdAt: daysAgo(message.daysAgo),
    };
    await prisma.contactMessage.upsert({
      where: { id: seedId("contact", index) },
      update: fields,
      create: { id: seedId("contact", index), ...fields },
    });
  }
  log(`contact messages ...... ${contactMessagesSeed.length} (2 unread)`);

  for (const [index, subscriber] of subscribersSeed.entries()) {
    const fields = {
      unsubscribeToken: seedId("unsub", index),
      isActive: subscriber.isActive,
      ip: "203.0.113.20",
      createdAt: daysAgo(subscriber.daysAgo),
    };
    await prisma.subscriber.upsert({
      where: { email: subscriber.email },
      update: fields,
      create: { email: subscriber.email, ...fields },
    });
  }
  log(`subscribers ........... ${subscribersSeed.length} (1 unsubscribed)`);

  for (const redirect of redirectsSeed) {
    await prisma.urlRedirect.upsert({
      where: { fromPath: redirect.fromPath },
      update: { toPath: redirect.toPath, statusCode: redirect.statusCode, isAuto: redirect.isAuto },
      create: redirect,
    });
  }
  log(`redirects ............. ${redirectsSeed.length}`);

  for (const [index, entry] of auditLogSeed.entries()) {
    const fields = {
      userId: staffAuthor.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entitySlug,
      ip: "203.0.113.30",
      meta: { source: "seed" } as Prisma.InputJsonValue,
      createdAt: hoursAgo(entry.hoursAgo),
    };
    await prisma.auditLog.upsert({
      where: { id: seedId("audit", index) },
      update: fields,
      create: { id: seedId("audit", index), ...fields },
    });
  }
  log(`audit log entries ..... ${auditLogSeed.length}`);
}

// ═══════════════════════════════════════════════════════════════
// CLEAN
// ═══════════════════════════════════════════════════════════════

/**
 * Removes everything `seedContent` created, in foreign-key order, and nothing
 * else. Taxonomy rows are only dropped when no surviving content references
 * them, so a seeded category that someone later attached a real post to stays.
 *
 * Site settings and the About page are deliberately left in place: they are
 * configuration the site needs to render, not sample content.
 */
export async function cleanContent(prisma: PrismaClient, log: Log): Promise<void> {
  const postSlugs = postsSeed.map((p) => p.slug);
  const researchSlugs = researchSeed.map((r) => r.slug);
  const videoSlugs = videosSeed.map((v) => v.slug);
  const authorSlugs = authorsSeed.map((a) => a.slug);
  const segmentSlugs = gallerySeed.map((g) => g.slug);
  const memberEmails = memberUsersSeed.map((m) => m.email);

  const { count: comments } = await prisma.comment.deleteMany({
    where: { id: { startsWith: SEED_ID } },
  });
  log(`comments .............. ${comments} removed`);

  // Posts cascade their categories, tags, comments, and likes.
  const { count: posts } = await prisma.post.deleteMany({ where: { slug: { in: postSlugs } } });
  log(`posts ................. ${posts} removed`);

  // Research cascades its byline, tags, files, and view log.
  const { count: research } = await prisma.research.deleteMany({
    where: { slug: { in: researchSlugs } },
  });
  log(`research .............. ${research} removed`);

  const { count: authors } = await prisma.author.deleteMany({
    where: { slug: { in: authorSlugs } },
  });
  log(`authors ............... ${authors} removed`);

  const { count: videos } = await prisma.video.deleteMany({ where: { slug: { in: videoSlugs } } });
  log(`videos ................ ${videos} removed`);

  // Segments cascade their images; both must go before the media rows they
  // point at, because GalleryImage -> Media is a restricting relation.
  const { count: segments } = await prisma.gallerySegment.deleteMany({
    where: { slug: { in: segmentSlugs } },
  });
  log(`gallery segments ...... ${segments} removed`);

  // Same reason: HeroSlide -> Media is restricting.
  const { count: heroSlides } = await prisma.heroSlide.deleteMany({
    where: { id: { startsWith: SEED_ID } },
  });
  log(`hero slides ........... ${heroSlides} removed`);

  const { count: contactMessages } = await prisma.contactMessage.deleteMany({
    where: { id: { startsWith: SEED_ID } },
  });
  log(`contact messages ...... ${contactMessages} removed`);

  const { count: subscribers } = await prisma.subscriber.deleteMany({
    where: { unsubscribeToken: { startsWith: SEED_ID } },
  });
  log(`subscribers ........... ${subscribers} removed`);

  const { count: redirects } = await prisma.urlRedirect.deleteMany({
    where: { fromPath: { in: redirectsSeed.map((r) => r.fromPath) } },
  });
  log(`redirects ............. ${redirects} removed`);

  const { count: auditLogs } = await prisma.auditLog.deleteMany({
    where: { id: { startsWith: SEED_ID } },
  });
  log(`audit log entries ..... ${auditLogs} removed`);

  // Member accounts cascade any remaining comments, likes, and sessions.
  const { count: members } = await prisma.user.deleteMany({
    where: { email: { endsWith: SEED_USER_EMAIL_DOMAIN } },
  });
  log(`member accounts ....... ${members} removed`);

  const { count: media } = await prisma.media.deleteMany({
    where: { blobName: { startsWith: SEED_MEDIA_PREFIX } },
  });
  log(`media ................. ${media} removed`);

  // Taxonomy last, and only where nothing is left pointing at it.
  const { count: tags } = await prisma.tag.deleteMany({
    where: {
      slug: { in: tagsSeed.map(tagSlug) },
      posts: { none: {} },
      research: { none: {} },
    },
  });
  log(`tags .................. ${tags} removed`);

  const { count: categories } = await prisma.category.deleteMany({
    where: {
      OR: categoriesSeed.map((c) => ({ scope: c.scope, slug: c.slug })),
      posts: { none: {} },
      research: { none: {} },
    },
  });
  log(`categories ............ ${categories} removed`);

  const { count: videoCategories } = await prisma.videoCategory.deleteMany({
    where: {
      slug: { in: videoCategoriesSeed.map((c) => c.slug) },
      videos: { none: {} },
    },
  });
  log(`video categories ...... ${videoCategories} removed`);

  log("");
  log("Site settings and the About page were left in place — they are configuration,");
  log("not sample content. Remove them by hand if you really want an empty site.");
}
