/**
 * Response shapes for every entity the API hands back.
 *
 * These mirror the Prisma models plus whatever each service `include`s, so a
 * client can read the docs instead of the code. Objects stay open
 * (`additionalProperties: true`), so a field added to a model still reaches
 * the client even before it is documented here.
 */

import {
  JsonSchema,
  anyJson,
  arrayOf,
  bool,
  dateTime,
  enumOf,
  id,
  int,
  nullableDateTime,
  nullableInt,
  nullableStr,
  obj,
  slug,
  str,
} from "./common";

// ───────────────────────────── enums ─────────────────────────────

export const ROLE_VALUES = ["SUPER_ADMIN", "ADMIN", "EDITOR", "MEMBER"];
export const USER_STATUS_VALUES = ["WHITELISTED", "ACTIVE", "SUSPENDED"];
export const CONTENT_STATUS_VALUES = ["DRAFT", "PUBLISHED"];
export const PLACEMENT_VALUES = ["ARTICLE", "BLOG", "BOTH"];
export const CATEGORY_SCOPE_VALUES = ["ARTICLE", "BLOG", "RESEARCH"];
export const EDITOR_MODULES = ["posts", "research", "gallery", "videos", "media"];

const seoFields = {
  metaTitle: nullableStr("`<title>` override. Falls back to the record's own title."),
  metaDescription: nullableStr("`<meta name=\"description\">` override."),
  noIndex: bool("When true the page is served with `noindex, nofollow`.", { example: false }),
};

// ───────────────────────────── media ─────────────────────────────

export const mediaSchema = obj("A file in the public media library (S3 + CDN).", {
  id: id("media"),
  url: str("Public CDN URL of the original file.", {
    example: "https://cdn.radhakundah.com/media/2026/01/kunda.webp",
  }),
  fileName: str("Original upload file name.", { example: "kunda.jpg" }),
  mimeType: str("Detected MIME type — sniffed from the bytes, not the client.", {
    example: "image/webp",
  }),
  sizeBytes: int("Stored size in bytes.", { example: 184320 }),
  width: nullableInt("Pixel width. Null for non-images."),
  height: nullableInt("Pixel height. Null for non-images."),
  alt: nullableStr("Alt text used wherever the image is rendered."),
  folder: str("Virtual folder inside the library.", { example: "/gallery" }),
  variants: anyJson(
    "Generated renditions keyed by size: `{ thumb, medium, large, og }`, each with a `webp` and original URL. Null until processing finishes."
  ),
  createdAt: dateTime("When the file was uploaded."),
  updatedAt: dateTime("When the metadata was last changed."),
});

export const nullableMediaSchema: JsonSchema = { ...mediaSchema, nullable: true };

/** Projection returned by the Media module itself (no `s3Key`, no uploader). */
export const mediaItemSchema = obj("Media library entry.", {
  id: id("media"),
  url: str("Public CDN URL.", { example: "https://cdn.radhakundah.com/media/kunda.webp" }),
  fileName: str("Original upload file name.", { example: "kunda.jpg" }),
  mimeType: str("Detected MIME type.", { example: "image/webp" }),
  sizeBytes: int("Stored size in bytes.", { example: 184320 }),
  width: nullableInt("Pixel width."),
  height: nullableInt("Pixel height."),
  alt: nullableStr("Alt text."),
  folder: str("Virtual folder.", { example: "/" }),
  createdAt: dateTime("Upload timestamp."),
});

// ───────────────────────────── users & sessions ─────────────────────────────

export const userSchema = obj("A platform user. Staff and members share this model.", {
  id: id("user"),
  email: str("Google account email. Unique.", { example: "editor@radhakundah.com" }),
  name: str("Display name.", { example: "Ananda Das" }),
  avatarUrl: nullableStr("Google profile picture URL."),
  role: enumOf(ROLE_VALUES, "Capability tier."),
  status: enumOf(
    USER_STATUS_VALUES,
    "`WHITELISTED` = pre-created, has not signed in yet. `SUSPENDED` = sign-in blocked."
  ),
  editorModules: arrayOf(
    enumOf(EDITOR_MODULES, "Module key."),
    "Modules an EDITOR may write to. Ignored for other roles."
  ),
  isProtected: bool(
    "The seeded super admin. Cannot be demoted, suspended, or deleted by anyone — clients should present the account as read-only rather than offering actions that will 403."
  ),
  lastLoginAt: nullableDateTime("Last successful Google sign-in. Null if never."),
  createdAt: dateTime("When the row was created."),
});

export const userStatusOnlySchema = obj("User identity plus its new status.", {
  id: id("user"),
  email: str("Google account email.", { example: "editor@radhakundah.com" }),
  status: enumOf(USER_STATUS_VALUES, "Status after the change."),
});

export const meSchema = obj("The signed-in user's own profile.", {
  id: id("user"),
  email: str("Google account email.", { example: "you@example.com" }),
  name: str("Display name.", { example: "Ananda Das" }),
  avatarUrl: nullableStr("Google profile picture URL."),
  role: enumOf(ROLE_VALUES, "Your role."),
  status: enumOf(USER_STATUS_VALUES, "Your account status."),
  editorModules: arrayOf(enumOf(EDITOR_MODULES, "Module key."), "Modules you may write to."),
  lastLoginAt: nullableDateTime("Your previous sign-in."),
  createdAt: dateTime("When your account was created."),
});

export const sessionSchema = obj("A refresh-token session. The token itself is never returned.", {
  id: id("session"),
  userAgent: nullableStr("User agent captured at sign-in."),
  ip: nullableStr("IP captured at sign-in.", { example: "203.0.113.9" }),
  createdAt: dateTime("When the session started."),
  expiresAt: dateTime("When the refresh token expires (30 days after issue)."),
});

export const authPayloadSchema = obj("A fresh access token and who it belongs to.", {
  accessToken: str(
    "JWT bearer token, valid 15 minutes. Send as `Authorization: Bearer <token>`.",
    { example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
  ),
  user: obj("Identity behind the token.", {
    id: id("user"),
    email: str("Google account email.", { example: "you@example.com" }),
    name: str("Display name.", { example: "Ananda Das" }),
    role: enumOf(ROLE_VALUES, "Role encoded in the token."),
  }),
});

// ───────────────────────────── taxonomy ─────────────────────────────

export const categorySchema = obj("A post or research category. Slugs are unique per scope.", {
  id: id("category"),
  scope: enumOf(CATEGORY_SCOPE_VALUES, "Which content type this category belongs to."),
  name: str("Display name.", { example: "Philosophy" }),
  slug: slug("category"),
  description: nullableStr("Short blurb shown on the category page."),
  order: int("Manual sort position, ascending.", { example: 0 }),
  ...seoFields,
  createdAt: dateTime("Creation timestamp."),
  updatedAt: dateTime("Last update timestamp."),
});

export const nullableCategorySchema: JsonSchema = { ...categorySchema, nullable: true };

export const tagSchema = obj("A free-form tag shared by posts and research.", {
  id: id("tag"),
  name: str("Tag label. Unique.", { example: "bhakti" }),
  slug: slug("tag"),
  createdAt: dateTime("Creation timestamp."),
});

export const videoCategorySchema = obj("A category in the video section's own taxonomy.", {
  id: id("video category"),
  name: str("Display name.", { example: "Kirtan" }),
  slug: slug("video category"),
  description: nullableStr("Short blurb."),
  order: int("Manual sort position.", { example: 0 }),
  ...seoFields,
});

export const nullableVideoCategorySchema: JsonSchema = { ...videoCategorySchema, nullable: true };

// ───────────────────────────── posts ─────────────────────────────

const postAuthorSchema = obj("The staff member who wrote the post.", {
  id: id("user"),
  name: str("Display name.", { example: "Ananda Das" }),
  email: str("Account email.", { example: "ananda@radhakundah.com" }),
  avatarUrl: nullableStr("Profile picture URL."),
});

export const postSchema = obj("An article or blog entry. One model, split by `placement`.", {
  id: id("post"),
  placement: enumOf(
    PLACEMENT_VALUES,
    "Where it appears. `BOTH` is canonical at `/articles/{slug}` and 301s from `/blogs/{slug}`."
  ),
  status: enumOf(CONTENT_STATUS_VALUES, "Publication state."),
  title: str("Post title.", { example: "The History of Radha Kunda" }),
  slug: slug("post"),
  excerpt: nullableStr("Summary. Auto-derived from the content when not supplied."),
  content: str("Sanitised rich-text HTML body.", { example: "<p>…</p>" }),
  coverImageId: nullableStr("Id of the cover image in the media library."),
  authorId: str("Id of the authoring user.", { example: "clw8x2k4h0000v8p2q1r3s4t5" }),
  publishedAt: nullableDateTime(
    "Publication instant. A future value means scheduled — public queries only return `publishedAt <= now()`."
  ),
  isFeatured: bool("Pinned to the homepage feature rail.", { example: false }),
  viewCount: int("Total recorded views.", { example: 1204 }),
  commentsEnabled: bool("Whether members may comment.", { example: true }),
  metaKeywords: nullableStr("Comma-separated keywords."),
  ogImageId: nullableStr("Id of the Open Graph image."),
  canonicalUrl: nullableStr("External canonical URL, if this is a syndicated copy."),
  ...seoFields,
  createdAt: dateTime("Creation timestamp."),
  updatedAt: dateTime("Last update timestamp."),
  author: postAuthorSchema,
  coverImage: nullableMediaSchema,
  ogImage: nullableMediaSchema,
  categories: arrayOf(
    obj("Join row.", { categoryId: id("category"), postId: id("post"), category: categorySchema }),
    "Categories attached to the post."
  ),
  tags: arrayOf(
    obj("Join row.", { tagId: id("tag"), postId: id("post"), tag: tagSchema }),
    "Tags attached to the post."
  ),
});

export const postSummarySchema = obj("Compact post card used by homepage rails.", {
  id: id("post"),
  title: str("Post title.", { example: "The History of Radha Kunda" }),
  slug: slug("post"),
  excerpt: nullableStr("Summary line."),
  publishedAt: nullableDateTime("Publication instant."),
  coverImage: nullableMediaSchema,
});

// ───────────────────────────── research ─────────────────────────────

export const authorSchema = obj(
  "A publication author. Separate from `User` — a paper author needs no account.",
  {
    id: id("author"),
    name: str("Full name.", { example: "Dr. R. Sharma" }),
    slug: slug("author"),
    affiliation: nullableStr("Institution or department."),
    bio: nullableStr("Short biography."),
    photoId: nullableStr("Id of the portrait in the media library."),
    email: nullableStr("Contact email.", { example: "r.sharma@example.edu" }),
    orcid: nullableStr("ORCID identifier.", { example: "0000-0002-1825-0097" }),
    ...seoFields,
    createdAt: dateTime("Creation timestamp."),
    updatedAt: dateTime("Last update timestamp."),
    photo: nullableMediaSchema,
  }
);

/** File metadata exposed publicly — no URL and no S3 key. */
export const publicResearchFileSchema = obj(
  "An attached PDF. The download URL is issued separately and only to signed-in users.",
  {
    id: id("research file"),
    label: str("Human label for the file.", { example: "Full paper" }),
    fileName: str("Original file name.", { example: "radha-kunda-2026.pdf" }),
    sizeBytes: int("File size in bytes.", { example: 2458112 }),
    pageCount: nullableInt("Number of PDF pages, when it could be parsed."),
  }
);

export const researchFileSchema = obj("An attached PDF in the private bucket.", {
  id: id("research file"),
  researchId: id("research"),
  label: str("Human label for the file.", { example: "Full paper" }),
  s3Key: str("Key in the private S3 bucket. Admin-only.", { example: "research/2026/paper.pdf" }),
  fileName: str("Original file name.", { example: "radha-kunda-2026.pdf" }),
  mimeType: str("MIME type. Always `application/pdf`.", { example: "application/pdf" }),
  sizeBytes: int("File size in bytes.", { example: 2458112 }),
  pageCount: nullableInt("Number of PDF pages."),
  order: int("Sort position within the publication.", { example: 0 }),
  createdAt: dateTime("Upload timestamp."),
});

const researchAuthorLinkSchema = obj("Authorship join row.", {
  researchId: id("research"),
  authorId: id("author"),
  order: int("Byline position, ascending.", { example: 0 }),
  isCorresponding: bool("Marks the corresponding author.", { example: false }),
  author: authorSchema,
});

const researchCoreFields = {
  id: id("research"),
  title: str("Publication title.", { example: "Hydrology of Radha Kunda" }),
  slug: slug("research"),
  abstract: str("Public abstract. The PDF body is access-gated.", { example: "This paper …" }),
  categoryId: nullableStr("Id of the `RESEARCH`-scoped category."),
  status: enumOf(CONTENT_STATUS_VALUES, "Publication state."),
  publishedAt: nullableDateTime("Publication instant. Future values are scheduled."),
  isFeatured: bool("Pinned to the homepage.", { example: false }),
  viewCount: int("Total recorded views.", { example: 342 }),
  doi: nullableStr("Digital Object Identifier.", { example: "10.1000/xyz123" }),
  journal: nullableStr("Journal name."),
  volume: nullableStr("Journal volume."),
  issue: nullableStr("Journal issue."),
  pages: nullableStr("Page range.", { example: "112-130" }),
  publicationYear: nullableInt("Year of publication.", { example: 2026 }),
  keywords: arrayOf(str("Keyword."), "Author-supplied keywords."),
  ogImageId: nullableStr("Id of the Open Graph image."),
  ...seoFields,
  createdAt: dateTime("Creation timestamp."),
  updatedAt: dateTime("Last update timestamp."),
  category: nullableCategorySchema,
  ogImage: nullableMediaSchema,
  authors: arrayOf(researchAuthorLinkSchema, "Byline, ordered."),
  tags: arrayOf(
    obj("Join row.", { tagId: id("tag"), researchId: id("research"), tag: tagSchema }),
    "Tags attached to the publication."
  ),
};

export const researchSchema = obj("A research publication, as staff see it.", {
  ...researchCoreFields,
  extractedText: nullableStr(
    "Text pulled out of the attached PDFs to feed full-text search. Returned on admin reads only — the public endpoints strip it."
  ),
  files: arrayOf(researchFileSchema, "Attached PDFs with their storage keys."),
});

export const publicResearchSchema = obj("A published research record, safe for anonymous callers.", {
  ...researchCoreFields,
  files: arrayOf(publicResearchFileSchema, "Attached PDFs without download URLs."),
});

// ───────────────────────────── gallery ─────────────────────────────

export const galleryImageSchema = obj("One image inside a gallery segment.", {
  id: id("gallery image"),
  segmentId: id("gallery segment"),
  mediaId: id("media"),
  alt: str("Alt text. Required at upload for accessibility and image SEO.", {
    example: "Steps leading down to Radha Kunda at dawn",
  }),
  caption: nullableStr("Caption rendered under the image."),
  order: int("Sort position within the segment.", { example: 0 }),
  createdAt: dateTime("When the image was added."),
  media: mediaSchema,
});

export const gallerySegmentSchema = obj("A named group of gallery images.", {
  id: id("gallery segment"),
  name: str("Segment name.", { example: "Kartik Parikrama" }),
  slug: slug("gallery segment"),
  description: nullableStr("Blurb shown on the segment card."),
  coverImageId: nullableStr("Id of the card image."),
  order: int("Sort position in the gallery index.", { example: 0 }),
  isPublished: bool("Hidden from public endpoints when false.", { example: true }),
  ...seoFields,
  createdAt: dateTime("Creation timestamp."),
  updatedAt: dateTime("Last update timestamp."),
  coverImage: nullableMediaSchema,
  images: arrayOf(galleryImageSchema, "Images in display order. Only on single-segment reads."),
  _count: obj("Row counts. Only on list reads.", {
    images: int("How many images the segment holds.", { example: 24 }),
  }),
});

// ───────────────────────────── videos ─────────────────────────────

export const videoSchema = obj("A YouTube video entry.", {
  id: id("video"),
  title: str("Video title.", { example: "Morning kirtan at Radha Kunda" }),
  slug: slug("video"),
  description: nullableStr("Description text."),
  youtubeId: str("Parsed YouTube id.", { example: "dQw4w9WgXcQ" }),
  thumbnailUrl: str("Thumbnail fetched from YouTube at save time.", {
    example: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  }),
  durationSec: nullableInt("Runtime in seconds.", { example: 754 }),
  categoryId: nullableStr("Id of the video category."),
  status: enumOf(CONTENT_STATUS_VALUES, "Publication state."),
  publishedAt: nullableDateTime("Publication instant. Future values are scheduled."),
  isFeatured: bool("Pinned to the homepage.", { example: false }),
  viewCount: int("Total recorded views.", { example: 88 }),
  ...seoFields,
  createdAt: dateTime("Creation timestamp."),
  updatedAt: dateTime("Last update timestamp."),
  category: nullableVideoCategorySchema,
});

// ───────────────────────────── engagement ─────────────────────────────

export const commentSchema = obj("A member comment on a post.", {
  id: id("comment"),
  postId: id("post"),
  userId: id("user"),
  body: str("Comment text, 1–5000 characters.", { example: "Thank you for this." }),
  isHidden: bool("Moderated out of public listings when true.", { example: false }),
  createdAt: dateTime("When it was posted."),
  updatedAt: dateTime("When it was last edited."),
  user: obj("Comment author.", {
    id: id("user"),
    name: str("Display name.", { example: "Ananda Das" }),
    avatarUrl: nullableStr("Profile picture URL."),
  }),
});

export const likeStateSchema = obj("Like state for the post after the call.", {
  liked: bool("Whether you now like the post.", { example: true }),
  count: int("Total likes on the post.", { example: 42 }),
});

// ───────────────────────────── site content ─────────────────────────────

export const heroSlideSchema = obj("A homepage hero slide.", {
  id: id("hero slide"),
  title: str("Headline.", { example: "Welcome to Radha Kunda" }),
  subtitle: nullableStr("Supporting line."),
  imageId: id("media"),
  ctaLabel: nullableStr("Call-to-action button label.", { example: "Explore research" }),
  ctaUrl: nullableStr("Call-to-action target.", { example: "/research" }),
  order: int("Slide order, ascending.", { example: 0 }),
  isActive: bool("Hidden from the public hero when false.", { example: true }),
  createdAt: dateTime("Creation timestamp."),
  image: mediaSchema,
});

export const pageSchema = obj("A static content page, addressed by `key` (e.g. `about`).", {
  id: id("page"),
  key: str("Stable page key used in the URL.", { example: "about" }),
  title: str("Page title.", { example: "About Us" }),
  sections: anyJson(
    "Free-form section tree, e.g. `{ about, mission, vision, objectives, team[], journey[], contact }`. Shape is owned by the frontend."
  ),
  ogImageId: nullableStr("Id of the Open Graph image."),
  ...seoFields,
  updatedAt: dateTime("Last update timestamp."),
});

export const settingsMapSchema: JsonSchema = {
  type: "object",
  description:
    "Settings as a flat key → value map. Keys are dotted, e.g. `site.title`, `contact.email`, `social.youtube`, `analytics.ga4`. Values are arbitrary JSON.",
  additionalProperties: true,
  example: {
    "site.title": "Radhakundah",
    "contact.email": "hello@radhakundah.com",
    "social.youtube": "https://youtube.com/@radhakundah",
  },
};

export const contactMessageSchema = obj("A message submitted through the public contact form.", {
  id: id("contact message"),
  name: str("Sender name.", { example: "Ananda Das" }),
  email: str("Sender email.", { example: "ananda@example.com" }),
  phone: nullableStr("Sender phone."),
  subject: nullableStr("Subject line."),
  message: str("Message body.", { example: "I would like to know more about…" }),
  ip: nullableStr("Submitting IP, kept for abuse handling.", { example: "203.0.113.9" }),
  isRead: bool("Whether an admin has marked it read.", { example: false }),
  createdAt: dateTime("Submission timestamp."),
});

export const subscriberSchema = obj("A newsletter subscriber.", {
  id: id("subscriber"),
  email: str("Subscribed email. Unique.", { example: "reader@example.com" }),
  unsubscribeToken: str("Token behind the one-click unsubscribe link.", { example: "a1b2c3d4…" }),
  isActive: bool("False once unsubscribed.", { example: true }),
  ip: nullableStr("IP that submitted the form."),
  createdAt: dateTime("Subscription timestamp."),
});

// ───────────────────────────── SEO & ops ─────────────────────────────

export const redirectSchema = obj("A stored URL redirect served by the frontend middleware.", {
  id: id("redirect"),
  fromPath: str("Incoming path to match. Unique.", { example: "/blogs/old-slug" }),
  toPath: str("Destination path.", { example: "/articles/new-slug" }),
  statusCode: int("HTTP status to emit.", { example: 301 }),
  isAuto: bool("True when written automatically after a slug change.", { example: true }),
  createdAt: dateTime("Creation timestamp."),
});

export const nullableRedirectSchema: JsonSchema = {
  ...redirectSchema,
  nullable: true,
  description: "The matching redirect, or null when the path has no rule.",
};

export const auditLogSchema = obj("One entry in the admin audit trail.", {
  id: id("audit log"),
  userId: nullableStr("Actor id. Null for system actions."),
  action: str("Dotted action name.", { example: "post.publish" }),
  entityType: nullableStr("Entity kind the action touched.", { example: "post" }),
  entityId: nullableStr("Id of the touched entity."),
  ip: nullableStr("Actor IP.", { example: "203.0.113.9" }),
  meta: anyJson("Extra action-specific detail, e.g. `{ fileName, sizeBytes }`."),
  createdAt: dateTime("When the action happened."),
  user: obj("Actor identity, when still present.", {
    id: id("user"),
    name: str("Display name.", { example: "Ananda Das" }),
    email: str("Account email.", { example: "ananda@radhakundah.com" }),
    avatarUrl: nullableStr("Profile picture URL. Only on the activity feed."),
  }),
});

export const dashboardStatsSchema = obj("Headline counts for the admin dashboard.", {
  totalPosts: int("All posts, any status.", { example: 148 }),
  publishedPosts: int("Posts with status `PUBLISHED`.", { example: 121 }),
  draftPosts: int("Posts with status `DRAFT`.", { example: 27 }),
  researchCount: int("All research records.", { example: 34 }),
  galleryCount: int("All gallery segments.", { example: 12 }),
  videosCount: int("All videos.", { example: 63 }),
  usersCount: int("All users.", { example: 9 }),
  unreadMessages: int("Contact messages not yet marked read.", { example: 4 }),
});

export const searchResultSchema = obj("One full-text search hit.", {
  type: enumOf(["post", "research", "video"], "Which collection the hit came from."),
  id: str("Id of the matched record.", { example: "clw8x2k4h0000v8p2q1r3s4t5" }),
  title: str("Record title.", { example: "The History of Radha Kunda" }),
  slug: slug("record"),
  excerpt: nullableStr("Excerpt for posts, abstract for research, description for videos."),
  publishedAt: nullableDateTime("Publication instant."),
  rank: {
    type: "number",
    description: "Postgres `ts_rank` score. Always 0 for videos, which use ILIKE matching.",
    example: 0.0607927,
  },
});

export const seoSchema = obj(
  "Ready-to-render SEO block. Drop straight into the page head.",
  {
    title: str("Resolved `<title>`.", { example: "The History of Radha Kunda" }),
    description: str("Resolved meta description.", { example: "How the kunda took shape…" }),
    canonical: str("Absolute canonical URL.", {
      example: "https://radhakundah.com/articles/history-of-radha-kunda",
    }),
    robots: str("Robots directive.", { example: "index, follow" }),
    openGraph: obj("Open Graph tags.", {
      title: str("og:title.", { example: "The History of Radha Kunda" }),
      description: str("og:description.", { example: "How the kunda took shape…" }),
      image: str("og:image absolute URL. Absent when no image is set."),
      type: enumOf(["article", "website", "video.other"], "og:type."),
      url: str("og:url.", { example: "https://radhakundah.com/articles/history" }),
      siteName: str("og:site_name.", { example: "Radhakundah" }),
      publishedTime: str("article:published_time. Absent for non-articles."),
      modifiedTime: str("article:modified_time."),
      author: str("article:author."),
    }),
    twitter: obj("Twitter card tags.", {
      card: str("twitter:card.", { example: "summary_large_image" }),
      title: str("twitter:title.", { example: "The History of Radha Kunda" }),
      description: str("twitter:description.", { example: "How the kunda took shape…" }),
      image: str("twitter:image absolute URL."),
    }),
    jsonLd: arrayOf(
      anyJson("A schema.org JSON-LD document."),
      "JSON-LD blocks to emit as `<script type=\"application/ld+json\">`. Typically the entity plus a BreadcrumbList."
    ),
  }
);
