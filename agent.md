# Radhakundah Platform — Backend Project Context

> **Purpose of this document.** This is a complete, self-contained handoff for building the
> backend. It captures the client requirements, every design decision that was made and why,
> and the full technical plan. Anyone (or any agent) picking this up should need nothing else.
>
> **Repository:** `https://github.com/mahavi-official/NikunjaWebBackend`
> **Working instruction:** create a feature branch, do not commit directly to `main`.

---

## 0. How to use this document

- **Sections 1–3** are context: what the client asked for, and what we decided.
- **Sections 4–16** are the build plan.
- **Section 17** is the phase-by-phase implementation order — follow it top to bottom.
- **Section 18** lists the items that are still assumptions and must be confirmed before
  they become expensive to change.

Rules that apply to the whole build:

1. **Do not over-engineer.** No Redis, no message queues, no microservices, no GraphQL,
   no Kubernetes, no dynamic permissions UI. The scale does not justify any of it.
2. **Backend first, frontend later.** The API is finished and frozen before Next.js starts.
3. **SEO is designed in from the first migration**, never retrofitted.
4. Ignore the budget, dates, and signature pages in the client PDF — they are not
   engineering inputs.

---

## 1. Project background

**Client:** Nikunja Seva Pty Ltd (Australia). **Service provider:** Mahavi Pvt Ltd.
**Product:** the Radhakundah website + CMS — a content hub for research publications,
articles, blogs, media galleries, and YouTube videos, with a long-term path to additional
modules.

### 1.1 What the client asked for

- A modern, scalable, secure, user-friendly website with a simple CMS.
- Content types: **Research**, **Articles**, **Blogs**, **Gallery**, **Videos**,
  **About Us**, **Contact**.
- Multiple administrators with **role-based permissions**.
- A **modular architecture** so future modules can be added without a rebuild.

### 1.2 Home page composition

Hero banner, featured research, featured articles, latest blogs, latest videos, gallery
preview, recent updates, call to action, newsletter subscription.

### 1.3 Per-section requirements (from the client document)

| Section | Requirements |
|---|---|
| **About Us** | About Organization, Mission, Vision, Objectives, Our Team, Our Journey, Contact Information — all CMS-editable |
| **Research** | Title, Author, Date, Category, Abstract, PDF upload, Search, Filter, Featured |
| **Articles** | Rich text editor, featured image, categories, tags, SEO metadata, publish date, draft option |
| **Blogs** | Managed separately from Articles; on creation the editor picks Article / Blog / Both; each appears in its own section |
| **Gallery** | Gallery → Category/Folder → Images. Admin can create/rename/delete categories, upload multiple images, delete and reorder images |
| **Videos** | YouTube videos: title, description, YouTube link, thumbnail, category, publish date |
| **Contact** | Contact form, Google Map, email, phone, office address, messages stored in CMS |
| **CMS dashboard** | Total posts, published posts, draft posts, research count, gallery count, videos count, registered users, recent activities |
| **Roles** | Super Admin (full access, incl. user + role management, logs) and Editor (content only; cannot delete Super Admin, change settings, manage roles/permissions) |
| **Permissions** | Per-module View, Create, Edit, Delete, Publish, Unpublish |
| **Whitelisting** | Super Admin invites Editors and Admins; activate, suspend, remove users |
| **Content editor** | Rich text: headings, tables, images, hyperlinks, videos, lists, quotes, optional code blocks |
| **Search & filter** | By title, author, category, date, tags |
| **SEO** | Meta title, meta description, keywords, slug, Open Graph image, social sharing — on every page |
| **Media library** | Images, documents, PDFs, videos; folder management, search, preview, delete, replace |
| **Security** | Secure login, password encryption, RBAC, session management, activity logs, regular backups |
| **Performance** | Fast loading, mobile responsive, SEO friendly, optimized images, cross-browser |
| **Deliverables** | Website, responsive design, admin dashboard, CMS, source code, database, deployment support, user manual, admin training, documentation, bug fixes in warranty |

### 1.4 Future modules the architecture must accommodate

Donation Management, Volunteer Management, Learning Management System (LMS), Membership
Portal, Event Management, Online Courses, Podcast Management, Mobile Application API,
Multi-language Support, Restaurant Management.

**These must integrate without redeveloping the existing system.** They are *not* being
built now.

### 1.5 Gaps found in the client document, and how they were resolved

Four things in the client PDF were contradictory or undefined. All are now settled:

1. **Roles mismatch.** §5 defines only Super Admin and Editor, but §7 says the Super Admin
   invites "Editors *and* Admins."
   → **Resolved:** there are four roles — `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `MEMBER`. One
   Super Admin is seeded at first boot from environment variables and is permanently
   protected: no other account can delete, demote, or suspend it.

2. **"Recent Updates"** appears on the Home page but is defined nowhere.
   → **Resolved:** it is *not* a content type. It is a mixed feed of the newest published
   items across posts, research, and videos.

3. **"Registered Users"** on the dashboard implies public accounts, but nothing else
   described public registration.
   → **Resolved:** the CMS itself is never public. There *are* public members, but they
   sign in with OAuth and have no CMS access whatsoever.

4. **Article/Blog "Both" option** would produce two URLs for identical content.
   → **Resolved:** see §3.1 below. One canonical URL, always.

---

## 2. Technology stack (fixed)

| Layer | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP framework | **Fastify** |
| ORM | **Prisma** |
| Database | **PostgreSQL** |
| Frontend | **Next.js** (App Router) — built later |
| API style | **REST**, versioned `/api/v1` |
| Object storage | **S3** (two buckets: public media, private research PDFs) |
| Email | **Gmail SMTP** (App Password) |
| Auth | **Google OAuth only** — no passwords anywhere |
| Deployment | Backend and frontend deployed separately, **same parent domain** |

Exactly two applications: one Node backend, one Next.js frontend. Nothing else.

---

## 3. Decisions register

Every decision below was explicitly made. Do not revisit them without asking.

### 3.1 Content model — Articles and Blogs

- Articles and Blogs share **one `Post` model**, separated by a `placement` field:
  `ARTICLE`, `BLOG`, or `BOTH`. The editor picks this at creation time.
- `slug` is **globally unique across all posts**, guaranteeing exactly one canonical URL.
- **URL rules:**
  - `placement = ARTICLE` or `BOTH` → canonical `/articles/{slug}`
  - `placement = BLOG` → canonical `/blogs/{slug}`
- A `BOTH` post appears in **both listings**, but every link points at its single
  canonical `/articles/{slug}` URL.
- `/blogs/{slug}` for a `BOTH` post **301-redirects** to `/articles/{slug}`. The redirect
  row is created automatically and flagged `isAuto = false` so cleanup jobs never delete it.
  This means shared or guessed URLs still resolve, and link equity consolidates.

**Rationale for not serving two live URLs:** it is trivial to build, but it creates a
duplicate that must be canonicalized away — extra risk surface with no ranking upside and
only marginal user benefit.

- **Listings are fully tag/taxonomy-driven:** `/articles`, `/blogs`,
  `/articles/category/{slug}`, `/blogs/category/{slug}`, `/tags/{slug}`.

### 3.2 Taxonomy

- **Categories are scoped**: `ARTICLE`, `BLOG`, `RESEARCH` only. Slugs are unique per scope.
- A `BOTH` post may attach categories from both the ARTICLE and BLOG sets.
- **Videos have their own separate taxonomy** (`VideoCategory`), independent of the content
  category system, because videos are YouTube-only and structurally different.
- **Tags are shared** across posts and research, in a single global namespace.
- Categories are **flat** — no nesting.

### 3.3 Publishing workflow

- **No approval workflow.** Editors publish directly. Keep it simple.
- **Draft support** for editors, plus **scheduled publishing**: set a future `publishedAt`
  and it goes live automatically. No cron needed — public queries filter
  `status = PUBLISHED AND publishedAt <= now()`.
- **No revision history / rollback.** The audit log is the record of change.

### 3.4 Engagement

- **Likes, comments, and share** are supported on posts.
- Browsing never requires login. **Liking and commenting require sign-in.**
- Comments are published immediately; admins can hide or delete. A site setting can switch
  to hold-for-approval if spam appears. No approval queue is built up front.
- View counts are tracked on posts, research, and videos.

### 3.5 Research

- **PDFs are access-gated**: only signed-in users can view them, and downloading is
  discouraged.
  - **Accepted limitation (client agreed):** "view but not download" is *not* technically
    enforceable — anything the browser renders can be saved. What is delivered:
    private S3 bucket with public access blocked at the bucket policy, no public URL,
    **60-second presigned URLs** issued only to signed-in users, rendered in an inline
    PDF.js viewer with the download/print toolbar removed, `Content-Disposition: inline`,
    and right-click disabled. This stops casual downloading, not a determined user.
  - Every access is recorded in `ResearchView` — the gating is only meaningful if it is
    auditable.
- **Multiple files per research item** (main paper + appendices), 50 MB cap each.
- **`Author` is a separate entity** from `User` (a paper author need not have an account),
  supports **co-authors** with explicit ordering and a corresponding-author flag, and has
  its own indexable page at `/authors/{slug}`.
- **The PDF is the body.** There is no separate rich-text body; the public abstract is the
  only prose stored.
- **Optional academic metadata:** DOI, journal, volume, issue, pages, publication year,
  keywords.
- **PDF text is extracted and indexed for search** (stored in `extractedText`, never
  returned to clients).

### 3.6 Gallery

Structure is **Gallery → Segment → Images**:

- The gallery index shows each **segment** as a card with a **default/cover image** and a
  **short description**.
- Inside a segment there are **images only** — no nesting beyond this.
- Segments have their own indexable URLs: `/gallery/{slug}`.
- **Alt text is required** on every image at upload time (accessibility + image SEO).
  Captions are optional.
- Admin can create, rename, delete segments; upload multiple images; delete and reorder.

### 3.7 Videos

- **YouTube only.** No Vimeo, no self-hosted.
- The `youtubeId` is parsed from any YouTube URL form (watch, `youtu.be`, shorts, embed).
- **Thumbnails are auto-fetched from YouTube.**
- Each video gets its **own page** at `/videos/{slug}`, enabling `VideoObject` structured
  data.

### 3.8 Authentication — Google OAuth only

**There are no passwords anywhere in this system.** This is the single most consequential
decision. Everyone — members, editors, admins, super admin — signs in with Google.

**Staff whitelisting flow (this replaces token-based invites entirely):**

1. An admin inserts a `User` row with the person's email, a role, and
   `status = WHITELISTED`. No token, no email link, no password.
2. When that person signs in with Google and the email matches, `providerId` binds to their
   Google `sub` and `status` becomes `ACTIVE`. They now have their assigned role.
3. A Google sign-in with **no matching row** creates an ordinary `MEMBER` automatically.
4. A `SUSPENDED` user is rejected at sign-in.

**Consequences:** no password hashing, no email verification, no forgot-password flow, no
invite tokens, no 2FA decision. Considerable simplification.

**Risk and mitigation:** Google is the single point of failure for admin access. Mitigated
by seeding the super admin's email from `SUPER_ADMIN_EMAIL` at first boot with
`isProtected = true`, so that account always exists and can never be deleted or demoted.

**Tokens:**
- **Access token:** JWT, 15 min, `{ sub, role, editorModules }`, sent as
  `Authorization: Bearer`.
- **Refresh token:** opaque 32 random bytes, 30 days, stored **hashed** (SHA-256) in the
  `Session` table, delivered as
  `httpOnly; Secure; SameSite=Lax; Domain=.radhakundah.com; Path=/api/v1/auth`.
- **Rotation on every refresh.** Reuse of an already-rotated token revokes the entire
  session family.
- Because backend and frontend share a parent domain, no `SameSite=None` workaround is
  needed.

This design also satisfies the client's "Session Management" and "Activity Logs"
requirements directly.

### 3.9 Authorization — fixed role matrix

Roles are **hardcoded in the application**, not stored as editable permission rows. There
is no permissions-management UI. This is ~80 lines of code instead of several tables and a
screen.

| Capability | SUPER_ADMIN | ADMIN | EDITOR | MEMBER |
|---|:--:|:--:|:--:|:--:|
| Content CRUD + publish | ✓ | ✓ | ✓ (within `editorModules`) | — |
| Delete any content | ✓ | ✓ | own only | — |
| Media library | ✓ | ✓ | upload + own | — |
| Manage members | ✓ | ✓ | — | — |
| Whitelist / suspend / remove staff | ✓ | ✓ (never `SUPER_ADMIN`) | — | — |
| Site settings, SEO config, redirects | ✓ | — | — | — |
| Audit logs | ✓ | ✓ (read) | — | — |
| Like / comment / view research PDFs | ✓ | ✓ | ✓ | ✓ |

- `EDITOR` scope is controlled by `editorModules`, a string array such as
  `["posts","research","gallery","videos"]`.
- **Super admin protection is enforced in one place** (`users.service.ts`), not scattered
  across routes: any update, role change, suspend, or delete targeting a user with
  `isProtected = true` is rejected unless the actor is that same user.

### 3.10 Contact, newsletter, search

- **Contact:** stored in the CMS **and** emailed to `CONTACT_NOTIFY_TO`. The CMS supports
  view / mark-read / export CSV. No reply-from-dashboard.
- **Spam protection:** honeypot field + rate limit (3/hour per IP). **If the rate limit is
  hit, the endpoint escalates to requiring a reCAPTCHA v3 token.** reCAPTCHA is inert until
  `RECAPTCHA_SECRET` is configured.
- **Newsletter:** collect emails + export only. Single opt-in with an unsubscribe token.
  **No campaign sending** — Gmail SMTP caps around 500/day and cannot support blasts.
- **Search:** **PostgreSQL full-text search** — `tsvector` columns maintained by triggers,
  weighted (title = A, excerpt/abstract = B, body/extracted PDF text = C), with GIN
  indexes. Computed on write, so reads are index-only and the server is never strained.
  No Meilisearch, no Typesense.

### 3.11 Internationalisation

- **English only. i18n is NOT built** — it was judged too expensive relative to its value
  right now.
- Noted for the future only: if it is ever needed, the migration path is a `locale` column
  plus a `translationGroupId` on content tables. Additive, not a rewrite. Do not build this
  now.

### 3.12 Media and operations

- **S3 from day one**, two buckets: public (media library, CDN-fronted) and private
  (research PDFs, all public access blocked).
- **Image derivatives generated at upload** with `sharp`: thumb / medium / large / og
  (1200×630), each in WebP plus original format. EXIF stripped. This serves the client's
  "optimized images" and fast-loading requirements far better than transforming per request.
- **Backups:** `pg_dump` cron **every 3 days at 02:00**, gzipped to a private S3 bucket,
  90-day retention. **Database dump only** — media already lives in S3.
- **Audit log:** every write action and every auth event — actor, IP, entity, action. No
  field-level diffs. 12-month retention, pruned weekly.
- **Timezone:** everything stored **UTC**; API returns ISO 8601; the **browser formats to
  the user's local time** via `Intl.DateTimeFormat`.
  ⚠️ **SSR caveat:** server-rendered dates must use a fixed absolute/UTC format and only
  swap to local time on the client, or React will throw a hydration mismatch. The admin CMS
  displays Asia/Kathmandu.

### 3.13 Universal response format

**Every response** from the API, success or failure, uses one envelope:

```jsonc
// success
{
  "success": true,
  "data": { /* ... */ },
  "meta": { "page": 1, "limit": 20, "total": 84, "totalPages": 5 }
}

// failure
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable message",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

- `meta` is omitted on non-paginated responses.
- `error.code` is a **stable enum** the frontend switches on; `message` is for humans;
  `details` carries per-field validation errors.
- Pagination is **offset-based** (`?page=&limit=`) — adequate at this volume and simpler
  than cursors.

### 3.14 Explicitly rejected

Do not add any of these: Redis, BullMQ, Meilisearch/Typesense, Docker Swarm/Kubernetes,
NestJS, GraphQL, a dynamic permissions-management UI, revision history, comment approval
queues, multi-language tables, on-demand ISR revalidation webhooks, 2FA, password auth.

---

## 4. Backend architecture

A **single stateless Fastify + TypeScript REST API**, deployed independently of Next.js.

### 4.1 Layering

Strictly one direction:

```
route (HTTP concerns, schema validation)
  → service (business logic, permissions, transactions)
    → prisma (data access)
```

Routes never touch Prisma directly. Services never touch `req` / `reply`. This is the only
architectural rule that materially matters at this size.

### 4.2 API namespaces

This split drives caching, auth, and SSR behaviour:

| Namespace | Auth | Cacheable | Purpose |
|---|---|---|---|
| `/api/v1/public/*` | none | yes, CDN-friendly | everything Next.js SSR/ISR reads |
| `/api/v1/auth/*` | mixed | no | OAuth start/callback, refresh, logout |
| `/api/v1/me/*` | member+ | no | profile, likes, comments, gated research |
| `/api/v1/admin/*` | staff | no | the full CMS |

The `public` namespace returns **only published content** and requires no token, so SSR
never has to forward credentials for public pages.

### 4.3 Cross-cutting concerns (Fastify plugins)

Auth/JWT decoration, RBAC guard, rate limiting, error handler, request logging, Prisma
client, S3 client, mailer, audit logger.

### 4.4 Background work

Two `node-cron` jobs, in-process, no queue system:

1. Database backup every 3 days.
2. Audit-log pruning weekly.

Scheduled publishing needs **no job** — it is a query filter.

---

## 5. Folder structure

```
src/
├─ server.ts                 # build app, register plugins
├─ index.ts                  # listen, graceful shutdown
├─ config/
│  ├─ env.ts                 # zod-validated process.env, fails fast on boot
│  └─ constants.ts
├─ plugins/
│  ├─ prisma.ts
│  ├─ auth.ts                # verifies access token, decorates req.user
│  ├─ rbac.ts                # requireRole / requirePermission guards
│  ├─ rateLimit.ts
│  ├─ cors.ts
│  ├─ helmet.ts
│  ├─ multipart.ts
│  └─ errorHandler.ts
├─ modules/
│  ├─ auth/                  # Google OAuth, sessions, refresh rotation
│  ├─ users/                 # staff + members, whitelisting, sessions
│  ├─ posts/                 # articles + blogs (shared model)
│  ├─ research/
│  ├─ authors/
│  ├─ categories/
│  ├─ tags/
│  ├─ gallery/               # segments + images
│  ├─ videos/
│  ├─ media/                 # upload, derivatives, library
│  ├─ pages/                 # About singleton
│  ├─ hero/
│  ├─ engagement/            # likes, comments
│  ├─ contact/
│  ├─ newsletter/
│  ├─ search/
│  ├─ seo/                   # sitemaps, redirects, settings
│  ├─ settings/
│  └─ dashboard/             # CMS counts + recent activity
├─ lib/
│  ├─ errors.ts              # AppError + typed subclasses
│  ├─ jwt.ts
│  ├─ oauth.ts               # Google token exchange + profile fetch
│  ├─ slug.ts                # slugify + uniqueness + redirect-on-change
│  ├─ sanitize.ts            # rich-text HTML sanitizer
│  ├─ s3.ts                  # upload, presigned URLs
│  ├─ image.ts               # sharp derivatives
│  ├─ pdf.ts                 # text extraction for search
│  ├─ mailer.ts
│  ├─ audit.ts
│  ├─ pagination.ts
│  ├─ response.ts            # the universal envelope helpers
│  └─ seo.ts                 # buildSeo(), buildJsonLd()
├─ jobs/
│  ├─ backup.ts
│  └─ pruneAuditLogs.ts
├─ emails/                   # simple HTML templates
└─ types/

prisma/
├─ schema.prisma
├─ migrations/
└─ seed.ts                   # super admin, default categories, settings
```

**Each module folder is exactly four files** — `*.routes.ts`, `*.controller.ts`,
`*.service.ts`, `*.schema.ts` (Zod). Predictable, no deeper nesting.

---

## 6. Database schema

Complete and final, reflecting every decision above.

```prisma
// Radhakundah Platform — Prisma schema
// Conventions:
//   - All timestamps stored UTC. Clients format to local time.
//   - Every publicly indexable entity carries inline SEO columns.
//   - No passwords anywhere: authentication is Google OAuth only.

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════════════════════════════
// USERS & AUTH  (Google OAuth only — no passwords, no invites)
// ═══════════════════════════════════════════════════════════════

enum Role {
  SUPER_ADMIN
  ADMIN
  EDITOR
  MEMBER
}

enum UserStatus {
  WHITELISTED // staff email added, has not signed in yet
  ACTIVE
  SUSPENDED
}

enum AuthProvider {
  GOOGLE
}

/// Staff and members share this table. Role decides capability.
/// Whitelisting flow: admin inserts a row with email + role + WHITELISTED.
/// On first Google sign-in the email matches, providerId binds, status -> ACTIVE.
/// An unmatched Google sign-in creates a MEMBER row automatically.
model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String
  avatarUrl     String? // supplied by Google
  role          Role         @default(MEMBER)
  status        UserStatus   @default(ACTIVE)
  /// Seeded super admin. Cannot be deleted, demoted, or suspended by anyone.
  isProtected   Boolean      @default(false)
  /// EDITOR scope only, e.g. ["posts","research","gallery","videos"]
  editorModules String[]     @default([])
  provider      AuthProvider?
  providerId    String? // Google `sub`
  invitedById   String?
  lastLoginAt   DateTime?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  invitedBy     User?          @relation("Invites", fields: [invitedById], references: [id], onDelete: SetNull)
  invitedUsers  User[]         @relation("Invites")
  sessions      Session[]
  posts         Post[]
  comments      Comment[]
  likes         Like[]
  auditLogs     AuditLog[]
  mediaUploads  Media[]
  researchViews ResearchView[]

  @@unique([provider, providerId])
  @@index([role, status])
}

/// Refresh-token store. Enables real revocation and the "Session Management"
/// requirement. Token itself is never stored, only its SHA-256 hash.
model Session {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  userAgent String?
  ip        String?
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

/// Short-lived token backing Next.js draft mode.
model PreviewToken {
  id          String   @id @default(cuid())
  tokenHash   String   @unique
  entityType  String // "post" | "research"
  entityId    String
  createdById String
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([expiresAt])
}

// ═══════════════════════════════════════════════════════════════
// TAXONOMY
// ═══════════════════════════════════════════════════════════════

/// Videos deliberately excluded — they use VideoCategory instead.
enum CategoryScope {
  ARTICLE
  BLOG
  RESEARCH
}

model Category {
  id          String        @id @default(cuid())
  scope       CategoryScope
  name        String
  slug        String
  description String?
  order       Int           @default(0)

  metaTitle       String?
  metaDescription String?
  noIndex         Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  posts    PostCategory[]
  research Research[]

  @@unique([scope, slug])
  @@index([scope, order])
}

/// Shared freely across posts and research.
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  createdAt DateTime @default(now())

  posts    PostTag[]
  research ResearchTag[]
}

/// Independent taxonomy for the video section.
model VideoCategory {
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique
  description String?
  order       Int     @default(0)

  metaTitle       String?
  metaDescription String?
  noIndex         Boolean @default(false)

  videos Video[]
}

// ═══════════════════════════════════════════════════════════════
// POSTS  (articles + blogs share one model, split by `placement`)
// ═══════════════════════════════════════════════════════════════

enum Placement {
  ARTICLE
  BLOG
  BOTH
}

enum ContentStatus {
  DRAFT
  PUBLISHED
}

model Post {
  id              String        @id @default(cuid())
  placement       Placement
  status          ContentStatus @default(DRAFT)
  title           String
  /// Globally unique so each post has exactly one canonical URL.
  /// ARTICLE|BOTH -> /articles/{slug} ; BLOG -> /blogs/{slug}
  slug            String        @unique
  excerpt         String?
  content         String // sanitized HTML
  coverImageId    String?
  authorId        String
  /// Future value = scheduled. Public queries filter publishedAt <= now().
  publishedAt     DateTime?
  isFeatured      Boolean       @default(false)
  viewCount       Int           @default(0)
  commentsEnabled Boolean       @default(true)

  metaTitle       String?
  metaDescription String?
  metaKeywords    String?
  ogImageId       String?
  canonicalUrl    String? // manual override, rarely used
  noIndex         Boolean @default(false)

  searchVector Unsupported("tsvector")?
  createdAt    DateTime                 @default(now())
  updatedAt    DateTime                 @updatedAt

  author     User           @relation(fields: [authorId], references: [id])
  coverImage Media?         @relation("PostCover", fields: [coverImageId], references: [id], onDelete: SetNull)
  ogImage    Media?         @relation("PostOg", fields: [ogImageId], references: [id], onDelete: SetNull)
  categories PostCategory[]
  tags       PostTag[]
  comments   Comment[]
  likes      Like[]

  @@index([status, publishedAt(sort: Desc)])
  @@index([placement, status, publishedAt(sort: Desc)])
  @@index([isFeatured, status, publishedAt(sort: Desc)])
  @@index([authorId])
}

model PostCategory {
  postId     String
  categoryId String

  post     Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@id([postId, categoryId])
  @@index([categoryId])
}

model PostTag {
  postId String
  tagId  String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@index([tagId])
}

// ═══════════════════════════════════════════════════════════════
// RESEARCH & AUTHORS
// ═══════════════════════════════════════════════════════════════

/// Distinct from User: a paper author need not have an account.
model Author {
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique
  affiliation String?
  bio         String?
  photoId     String?
  email       String?
  orcid       String?

  metaTitle       String?
  metaDescription String?
  noIndex         Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  photo    Media?           @relation("AuthorPhoto", fields: [photoId], references: [id], onDelete: SetNull)
  research ResearchAuthor[]
}

model Research {
  id          String        @id @default(cuid())
  title       String
  slug        String        @unique
  /// Public. The PDF is the body and is access-gated.
  abstract    String
  categoryId  String?
  status      ContentStatus @default(DRAFT)
  publishedAt DateTime?
  isFeatured  Boolean       @default(false)
  viewCount   Int           @default(0)

  // Optional academic metadata
  doi             String?
  journal         String?
  volume          String?
  issue           String?
  pages           String?
  publicationYear Int?
  keywords        String[]

  metaTitle       String?
  metaDescription String?
  ogImageId       String?
  noIndex         Boolean @default(false)

  /// Text pulled from the PDFs. Feeds search only, never returned to clients.
  extractedText String?
  searchVector  Unsupported("tsvector")?
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt

  category Category?        @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  ogImage  Media?           @relation("ResearchOg", fields: [ogImageId], references: [id], onDelete: SetNull)
  authors  ResearchAuthor[]
  files    ResearchFile[]
  tags     ResearchTag[]
  views    ResearchView[]

  @@index([status, publishedAt(sort: Desc)])
  @@index([categoryId])
  @@index([publicationYear])
}

model ResearchAuthor {
  researchId      String
  authorId        String
  order           Int     @default(0)
  isCorresponding Boolean @default(false)

  research Research @relation(fields: [researchId], references: [id], onDelete: Cascade)
  author   Author   @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@id([researchId, authorId])
  @@index([authorId])
}

model ResearchTag {
  researchId String
  tagId      String

  research Research @relation(fields: [researchId], references: [id], onDelete: Cascade)
  tag      Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([researchId, tagId])
  @@index([tagId])
}

/// Lives in the PRIVATE S3 bucket. Never has a public URL.
/// Access is via a 60s presigned URL issued only to signed-in users.
model ResearchFile {
  id         String @id @default(cuid())
  researchId String
  label      String // "Main paper", "Appendix A"
  s3Key      String @unique
  fileName   String
  mimeType   String
  sizeBytes  Int
  pageCount  Int?
  order      Int    @default(0)

  createdAt DateTime @default(now())

  research Research @relation(fields: [researchId], references: [id], onDelete: Cascade)

  @@index([researchId, order])
}

/// Audit trail of who opened which paper — the gating requirement is
/// only meaningful if access is recorded.
model ResearchView {
  id         String   @id @default(cuid())
  researchId String
  userId     String
  fileId     String?
  ip         String?
  createdAt  DateTime @default(now())

  research Research @relation(fields: [researchId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([researchId, createdAt])
  @@index([userId, createdAt])
}

// ═══════════════════════════════════════════════════════════════
// GALLERY  (gallery -> segment -> images)
// ═══════════════════════════════════════════════════════════════

model GallerySegment {
  id           String  @id @default(cuid())
  name         String
  slug         String  @unique
  /// Short description shown on the segment card in the gallery index.
  description  String?
  /// Default image shown on the segment card.
  coverImageId String?
  order        Int     @default(0)
  isPublished  Boolean @default(true)

  metaTitle       String?
  metaDescription String?
  noIndex         Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coverImage Media?         @relation("SegmentCover", fields: [coverImageId], references: [id], onDelete: SetNull)
  images     GalleryImage[]

  @@index([isPublished, order])
}

model GalleryImage {
  id        String  @id @default(cuid())
  segmentId String
  mediaId   String
  /// Required at upload — accessibility and image SEO.
  alt       String
  caption   String?
  order     Int     @default(0)

  createdAt DateTime @default(now())

  segment GallerySegment @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  media   Media          @relation(fields: [mediaId], references: [id], onDelete: Restrict)

  @@index([segmentId, order])
}

// ═══════════════════════════════════════════════════════════════
// VIDEOS  (YouTube only)
// ═══════════════════════════════════════════════════════════════

model Video {
  id           String        @id @default(cuid())
  title        String
  slug         String        @unique
  description  String?
  /// Parsed from any YouTube URL form (watch, youtu.be, shorts, embed).
  youtubeId    String        @unique
  /// Auto-fetched from YouTube at save time.
  thumbnailUrl String
  durationSec  Int?
  categoryId   String?
  status       ContentStatus @default(DRAFT)
  publishedAt  DateTime?
  isFeatured   Boolean       @default(false)
  viewCount    Int           @default(0)

  metaTitle       String?
  metaDescription String?
  noIndex         Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  category VideoCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  @@index([status, publishedAt(sort: Desc)])
  @@index([categoryId])
  @@index([isFeatured, status])
}

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT  (requires sign-in; browsing does not)
// ═══════════════════════════════════════════════════════════════

model Comment {
  id        String   @id @default(cuid())
  postId    String
  userId    String
  body      String
  isHidden  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([postId, isHidden, createdAt])
  @@index([userId])
}

model Like {
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([postId, userId])
  @@index([userId])
}

// ═══════════════════════════════════════════════════════════════
// MEDIA LIBRARY  (public S3 bucket + CDN)
// ═══════════════════════════════════════════════════════════════

model Media {
  id        String  @id @default(cuid())
  s3Key     String  @unique
  url       String // public CDN URL of the original
  fileName  String
  mimeType  String
  sizeBytes Int
  width     Int?
  height    Int?
  alt       String?
  folder    String  @default("/")
  /// { thumb, medium, large, og } x { webp, original } generated by sharp
  variants  Json?

  uploadedById String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  uploadedBy       User?            @relation(fields: [uploadedById], references: [id], onDelete: SetNull)
  postCovers       Post[]           @relation("PostCover")
  postOgImages     Post[]           @relation("PostOg")
  researchOgImages Research[]       @relation("ResearchOg")
  authorPhotos     Author[]         @relation("AuthorPhoto")
  segmentCovers    GallerySegment[] @relation("SegmentCover")
  galleryImages    GalleryImage[]
  heroSlides       HeroSlide[]

  @@index([folder, createdAt])
}

// ═══════════════════════════════════════════════════════════════
// SITE CONTENT & CONFIG
// ═══════════════════════════════════════════════════════════════

/// About Us is the only page today; the model is reusable for future
/// static pages without new tables.
model Page {
  id    String @id @default(cuid())
  key   String @unique // "about"
  title String
  /// { about, mission, vision, objectives, team[], journey[], contact }
  sections Json

  metaTitle       String?
  metaDescription String?
  ogImageId       String?
  noIndex         Boolean @default(false)

  updatedAt DateTime @updatedAt
}

model HeroSlide {
  id       String  @id @default(cuid())
  title    String
  subtitle String?
  imageId  String
  ctaLabel String?
  ctaUrl   String?
  order    Int     @default(0)
  isActive Boolean @default(true)

  createdAt DateTime @default(now())

  image Media @relation(fields: [imageId], references: [id], onDelete: Restrict)

  @@index([isActive, order])
}

/// One row per setting key: site.title, site.logo, seo.defaultOgImage,
/// contact.email, contact.address, contact.mapEmbed, social.*, analytics.ga4
model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt
}

model ContactMessage {
  id        String   @id @default(cuid())
  name      String
  email     String
  phone     String?
  subject   String?
  message   String
  ip        String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([isRead, createdAt(sort: Desc)])
}

model Subscriber {
  id               String   @id @default(cuid())
  email            String   @unique
  unsubscribeToken String   @unique
  isActive         Boolean  @default(true)
  ip               String?
  createdAt        DateTime @default(now())

  @@index([isActive])
}

// ═══════════════════════════════════════════════════════════════
// SEO & OPERATIONS
// ═══════════════════════════════════════════════════════════════

/// Written automatically when a published item's slug changes, and used by
/// Next.js middleware to 301 instead of 404. Also holds the permanent
/// /blogs/{slug} -> /articles/{slug} rule for BOTH-placement posts.
model UrlRedirect {
  id         String   @id @default(cuid())
  fromPath   String   @unique
  toPath     String
  statusCode Int      @default(301)
  isAuto     Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@index([toPath])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String // "post.publish", "auth.login", "user.suspend"
  entityType String?
  entityId   String?
  ip         String?
  meta       Json?
  createdAt  DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([createdAt(sort: Desc)])
  @@index([userId, createdAt(sort: Desc)])
  @@index([entityType, entityId])
}
```

### 6.1 Relationship summary

- `User 1—n Post`
- `Post n—n Category` (scope-filtered) and `n—n Tag`
- `Research n—n Author` (ordered, supports co-authors) and `1—n ResearchFile`
- `GallerySegment 1—n GalleryImage`
- `Post 1—n Comment` and `1—n Like`
- `Media` is referenced by ID from everything that holds an image

**Cascade policy:** `Restrict` where an image is structural (gallery images, hero slides)
so deleting media cannot silently blank a gallery; `SetNull` where it is decorative
(covers, OG images).

### 6.2 Raw-SQL migrations required

Prisma cannot generate these for `Unsupported("tsvector")` columns. Write them as
hand-authored `migration.sql` files immediately after the initial migration:

1. A trigger function maintaining `Post.searchVector` —
   `setweight(to_tsvector('english', title),'A') || setweight(coalesce(excerpt,''),'B') || setweight(content,'C')`.
2. The same for `Research.searchVector` over title / abstract / `extractedText`.
3. `CREATE INDEX ... USING GIN (search_vector)` on both tables.

Use bound parameters. These are the only raw SQL in the project.

---

## 7. API endpoints

### 7.1 Public — no auth, `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

```
GET  /public/home                  # hero, featured, latest posts/videos/gallery, recent updates
GET  /public/posts?placement=&category=&tag=&q=&page=
GET  /public/posts/:slug           # 404 if unpublished; includes seo + jsonLd
GET  /public/research?category=&author=&year=&q=&page=
GET  /public/research/:slug        # metadata + abstract; file list WITHOUT urls
GET  /public/authors
GET  /public/authors/:slug
GET  /public/gallery               # segments with cover + short description
GET  /public/gallery/:slug         # images only
GET  /public/videos
GET  /public/videos/:slug
GET  /public/categories?scope=
GET  /public/video-categories
GET  /public/tags
GET  /public/pages/about
GET  /public/settings              # site title, logo, socials, contact, GA id
GET  /public/search?q=&type=&page=
GET  /public/comments?postId=&page=
POST /public/contact               # rate-limited, honeypot, captcha-on-escalation
POST /public/newsletter/subscribe
GET  /public/newsletter/unsubscribe/:token
POST /public/posts/:slug/view      # fire-and-forget increment
GET  /public/redirects?path=       # Next middleware asks before rendering a 404
```

### 7.2 SEO (XML, served by backend)

```
GET /sitemap.xml                   # sitemap index
GET /sitemaps/:type-:page.xml      # posts | research | gallery | videos | authors | categories | static
```

### 7.3 Auth

```
GET  /auth/google                  # redirect to Google consent
GET  /auth/google/callback         # exchange code, match/whitelist, issue tokens
POST /auth/refresh                 # rotates the refresh cookie
POST /auth/logout
POST /auth/logout-all
```

### 7.4 Me (authenticated members and above)

```
GET    /me
PATCH  /me
GET    /me/sessions
DELETE /me/sessions/:id
GET    /me/research/:slug/view-url  # 60s presigned S3 URL, gated + logged
POST   /me/posts/:id/like
DELETE /me/posts/:id/like
POST   /me/comments
PATCH  /me/comments/:id
DELETE /me/comments/:id
```

### 7.5 Admin (staff only) — uniform CRUD so the shape is learnable once

```
GET|POST         /admin/{posts|research|authors|videos|gallery|categories
                         |video-categories|tags|media|hero|users|pages}
GET|PATCH|DELETE /admin/{...}/:id

POST /admin/posts/:id/publish
POST /admin/posts/:id/unpublish
POST /admin/posts/:id/preview-token
POST /admin/gallery/:id/images        # multi-upload
POST /admin/gallery/:id/reorder       # [{ id, order }]
POST /admin/media/upload              # multipart

GET   /admin/contact-messages
PATCH /admin/contact-messages/:id/read
GET   /admin/contact-messages/export.csv
GET   /admin/newsletter/export.csv

GET /admin/dashboard/stats            # the 8 counts from the client spec
GET /admin/dashboard/activity         # recent activities
GET /admin/audit-logs

GET|POST|DELETE /admin/redirects
GET|PATCH       /admin/settings

POST /admin/users                     # whitelist an email with a role
POST /admin/users/:id/suspend
POST /admin/users/:id/activate
```

---

## 8. Validation, error handling, security

### 8.1 Validation

Zod schemas colocated per module, wired through `fastify-type-provider-zod` so request and
response types are inferred end-to-end and the same schemas generate OpenAPI docs. Every
route validates params, query, and body. **Response schemas are declared too** — Fastify
serializes faster and it structurally prevents leaking internal fields.

### 8.2 Errors

One `AppError` base with typed subclasses: `NotFound`, `Unauthorized`, `Forbidden`,
`Conflict`, `ValidationFailed`, `RateLimited`. A global handler maps:

- Zod error → `422 VALIDATION_FAILED` with field details
- Prisma `P2002` → `409 CONFLICT`
- Prisma `P2025` → `404 NOT_FOUND`
- anything unrecognised → `500 INTERNAL_ERROR`, logged with a correlation ID, generic
  message to the client

**Stack traces never leave the server in production.**

### 8.3 Security checklist

- `@fastify/helmet` — HSTS, `X-Content-Type-Options`, frame-deny, API-appropriate CSP.
- `@fastify/cors` with an explicit origin allowlist from env, `credentials: true`.
- `@fastify/rate-limit` — 100 req/min global per IP; 3/hour on contact and newsletter;
  tighter limits on the OAuth callback.
- **Rich-text HTML sanitized server-side** with `sanitize-html` on an allowlist (headings,
  tables, images, links, lists, blockquote, `pre`/`code`), stripping `<script>`, event
  handlers, and `javascript:` URLs. Client-side sanitizing is never trusted.
- **Uploads:** magic-byte type detection with `file-type`, never extension. Images 10 MB,
  PDFs 50 MB. Randomised S3 keys. EXIF stripped by `sharp`.
- Prisma parameterises everything; the only raw SQL is the tsvector triggers.
- Audit log on every write and every auth event.
- Secrets only via env, **validated at boot — the process refuses to start if a required
  variable is missing.**
- `X-Powered-By` disabled; request IDs on every log line.

---

## 9. SEO strategy

**Principle: the backend is the single source of SEO truth.** Next.js renders what the API
tells it and never invents metadata or runs fallback logic.

### 9.1 Dynamic meta titles and descriptions

Every indexable entity carries `metaTitle`, `metaDescription`, `metaKeywords`, `ogImageId`,
`canonicalUrl`, `noIndex`. Every detail endpoint returns a **resolved** `seo` object with
fallbacks already applied:

- `metaTitle || title`
- `metaDescription || excerpt || truncate(content, 155)`
- `ogImage || coverImage || site default`

Global title template and site defaults live in `Setting`.

### 9.2 SEO-friendly URLs and slugs

Auto-generated from the title (`slugify`, lowercase, hyphens, ASCII-folded), editable in
the CMS, uniqueness-checked with a `-2` suffix strategy. Post slugs are globally unique.
Category slugs are unique per scope.

### 9.3 Canonical URLs

Every detail response includes an absolute `seo.canonical`:

| Entity | Canonical |
|---|---|
| Post (`ARTICLE` \| `BOTH`) | `{SITE_URL}/articles/{slug}` |
| Post (`BLOG`) | `{SITE_URL}/blogs/{slug}` |
| Research | `{SITE_URL}/research/{slug}` |
| Video | `{SITE_URL}/videos/{slug}` |
| Gallery segment | `{SITE_URL}/gallery/{slug}` |
| Author | `{SITE_URL}/authors/{slug}` |

Paginated listings self-canonicalise to their own `?page=n` URL. A `BOTH` post shown in the
blog listing links to its `/articles/` canonical — **no duplicate content is ever
generated.**

### 9.4 Slug-change redirects

When a **published** item's slug changes, the service writes a `UrlRedirect` row
(`old → new`, 301) **inside the same transaction**, and rewrites any existing redirect
chain to point at the new target so chains never form. Next.js middleware queries
`/public/redirects?path=` on a 404 and issues a real 301.

This preserves link equity and is the single most commonly forgotten piece of CMS SEO.

### 9.5 Open Graph and social sharing

`seo` includes `og:title`, `og:description`, `og:image` (absolute URL, 1200×630 derivative
generated by `sharp` at upload), `og:type` (`article` / `website` / `video.other`),
`og:url`, `og:site_name`, `article:published_time`, `article:modified_time`,
`article:author`, plus `twitter:card=summary_large_image`. A site-wide default OG image
lives in `Setting`.

### 9.6 Structured data (JSON-LD)

Built **server-side** and returned as `seo.jsonLd` (an array of objects). Next dumps it
into `<script type="application/ld+json">`.

| Type | Where |
|---|---|
| `Organization` + `WebSite` (with `SearchAction`) | sitewide |
| `Article` / `BlogPosting` | posts |
| `ScholarlyArticle` | research — `author[]`, `datePublished`, `identifier` (DOI), `isPartOf` (journal) |
| `ImageGallery` | gallery segments |
| `VideoObject` | videos — `embedUrl`, `thumbnailUrl`, `uploadDate`, `duration` |
| `BreadcrumbList` | all detail pages |
| `ContactPage` | contact |
| `Person` | authors |

### 9.7 Sitemaps

Backend-generated, **paginated at 5,000 URLs per file**. `/sitemap.xml` is an index
pointing to `/sitemaps/posts-1.xml`, `research-1.xml`, `gallery-1.xml`, `videos-1.xml`,
`authors-1.xml`, `categories-1.xml`, `static-1.xml`.

`lastmod` comes from `updatedAt`. Unpublished, `noIndex`, and future-dated items are
excluded. Cached 1 hour. Next.js `rewrites` proxy `/sitemap.xml` so it serves from the
canonical domain.

### 9.8 robots.txt

Served by Next.js from `app/robots.ts`, driven by an env flag.

- **Production:** allow all; disallow `/admin`, `/api`, `/preview`, `/search?`; point to
  `{SITE_URL}/sitemap.xml`.
- **Any non-production environment:** `Disallow: /` **plus** an `X-Robots-Tag: noindex`
  header. This is what stops a staging deploy from being indexed.

### 9.9 Indexing rules

`noIndex` per entity, honoured in **both** the page's robots meta **and** sitemap
exclusion. Automatically noindexed: preview/draft pages, empty listing pages beyond a
threshold, tag pages with fewer than 3 items (thin content), member account pages, and
search results.

### 9.10 SEO-friendly API shape for SSR

Detail endpoints return everything a page needs in **one request**, so SSR makes a single
round trip and TTFB stays low:

```jsonc
{
  "success": true,
  "data": {
    "post": { /* ... */ },
    "seo": {
      "title": "...",
      "description": "...",
      "canonical": "https://radhakundah.com/articles/...",
      "robots": "index,follow",
      "openGraph": { /* ... */ },
      "twitter": { /* ... */ },
      "jsonLd": [ /* ... */ ]
    },
    "breadcrumbs": [{ "name": "...", "url": "..." }],
    "related": [ /* ... */ ]
  }
}
```

Listing endpoints return `meta: { page, limit, total, totalPages }` so Next can emit
`rel=prev/next` and paginated canonicals.

### 9.11 Dynamic page handling

All dynamic routes use `generateStaticParams` for the top N items plus
`dynamicParams: true` for the long tail. Unpublished or missing slugs return a **real 404**
via `notFound()` — never a soft 200. Trailing-slash behaviour is fixed to "off" and
enforced with a redirect. `SITE_URL` makes every emitted URL absolute.

---

## 10. SSR and Next.js integration

- **Rendering:** App Router with ISR — `revalidate: 60` for listings, `300` for detail
  pages, `3600` for About/settings. **No on-demand revalidation webhook** (decided);
  worst-case staleness is one minute.
- **Metadata:** every page exports `generateMetadata()` calling the same endpoint the page
  body uses. React `cache` dedupes it into one network call, not two.
- **Data layer:** a thin typed `apiClient` with `next: { revalidate, tags }` on every fetch.
  **Never call the API from client components for content that should be indexed.**
- **Draft preview:** admin generates a token (`POST /admin/posts/:id/preview-token`, 30-min
  expiry) linking to `/api/preview?token=...&slug=...`, a Next route handler that validates
  against the backend, enables `draftMode()`, and redirects. The page checks
  `draftMode().isEnabled` and requests the unpublished record. Draft pages force
  `robots: noindex, nofollow`.
- **Middleware:** handles only the 404-redirect lookup and trailing-slash normalisation.
  Middleware runs on every request — keep it minimal.
- **Frontend auth:** admin CMS and member areas are client-rendered behind `noindex`. The
  access token is held **in memory** and refreshed via the httpOnly cookie.
  **Never `localStorage`.**
- **Images:** `next/image` with the S3/CDN domain in `remotePatterns`, pointed at the
  pre-generated derivatives. Above-the-fold hero uses `priority`.
- **Rewrites:** `/sitemap.xml` and `/sitemaps/*` proxied to the API.

---

## 11. Packages

**Backend runtime:** `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`,
`@fastify/multipart`, `@fastify/cookie`, `@fastify/static`, `@fastify/swagger`,
`@fastify/swagger-ui`, `fastify-type-provider-zod`, `zod`, `@prisma/client`,
`jsonwebtoken`, `google-auth-library`, `nodemailer`, `@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner`, `sharp`, `slugify`, `sanitize-html`, `file-type`,
`pdf-parse`, `pino`, `pino-pretty`, `node-cron`, `dotenv`.

**Backend dev:** `typescript`, `prisma`, `tsx`, `vitest`, `supertest`, `eslint`,
`prettier`, `@types/*`.

**Frontend (later):** `next`, `react`, `tailwindcss`, `@tanstack/react-query` (admin only),
`react-hook-form`, `zod`, `@tiptap/react`, `pdfjs-dist` / `react-pdf`, `lucide-react`,
`sonner`, `date-fns`.

---

## 12. Environment variables

```bash
NODE_ENV=production
PORT=4000
API_URL=https://api.radhakundah.com
SITE_URL=https://radhakundah.com            # canonical, used in all SEO output
CORS_ORIGINS=https://radhakundah.com

DATABASE_URL=postgresql://...

JWT_ACCESS_SECRET=
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_DOMAIN=.radhakundah.com
COOKIE_SECURE=true

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.radhakundah.com/api/v1/auth/google/callback

SUPER_ADMIN_EMAIL=                          # seeded once, protected forever
SUPER_ADMIN_NAME=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=                                  # Gmail App Password (requires 2FA on account)
MAIL_FROM="Radhakundah <no-reply@radhakundah.com>"
CONTACT_NOTIFY_TO=

S3_REGION=
S3_BUCKET_PUBLIC=                           # media library
S3_BUCKET_PRIVATE=                          # research PDFs, block ALL public access
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=                         # CDN in front of the public bucket
SIGNED_URL_TTL_SECONDS=60

BACKUP_ENABLED=true
BACKUP_CRON="0 2 */3 * *"                   # 02:00 every 3 days
BACKUP_S3_BUCKET=
BACKUP_RETENTION_DAYS=90

RECAPTCHA_SECRET=                           # optional; captcha inert if empty
PREVIEW_TOKEN_TTL_MINUTES=30
LOG_LEVEL=info
```

**Frontend:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `API_INTERNAL_URL`,
`NEXT_PUBLIC_ENABLE_INDEXING`.

---

## 13. Production, performance, scalability

### 13.1 Performance

- Indexes declared up front on every filter and sort path. Run `EXPLAIN ANALYZE` on the
  listing queries before launch.
- **No N+1:** Prisma `select` / `include` are explicit everywhere. **List endpoints never
  return full `content` bodies** — excerpts only.
- `Cache-Control` on the public namespace lets a CDN absorb most read traffic.
- Images pre-derived at upload rather than transformed per request.
- Fastify's schema-based serialisation is meaningfully faster than `JSON.stringify` —
  worth declaring response schemas.
- Gzip/brotli at the edge; Postgres connection pooling tuned to the host.

### 13.2 Scalability

- The backend is **stateless** (sessions in Postgres, files in S3) so it scales
  horizontally behind a load balancer with no changes.
- **Future modules** (donations, volunteers, LMS, events, podcasts, membership) are added
  as new module folders plus new tables. Nothing existing is rewritten. `Media`,
  `Category`, `Tag`, `AuditLog`, `Setting`, and the RBAC layer are already shared
  infrastructure they reuse.
- **Mobile Application API:** the existing REST layer *is* that API. Only a token-based
  mobile auth variant would need adding.

### 13.3 Reliability and operations

- `pg_dump` → gzip → private S3, 90-day retention, with a **documented and tested restore
  procedure**. An untested backup is not a backup.
- Structured `pino` JSON logs with request IDs.
- `/health` (liveness) and `/health/ready` (DB reachable).
- Graceful shutdown draining in-flight requests.
- **Prisma migrations run as an explicit deploy step, never auto-applied at boot.**

### 13.4 Security in production

- TLS everywhere, HSTS with preload.
- Private S3 bucket with public access blocked **at the bucket policy level**, not just
  object ACLs.
- **Least-privilege IAM** — separate credentials for media, private files, and backups.
- No secrets in the repository.
- The audit log provides a defensible record of who changed what — this is what the
  client's "Activity Logs" requirement actually means.
- `npm audit` in CI.

---

## 14. Acceptance criteria (from the client)

The project is complete when: all approved features are implemented; user roles function
correctly; permission management works as specified; gallery categorisation operates
properly; **Articles and Blogs are separated**; research uploads and downloads function
correctly; the website is responsive across desktop, tablet, and mobile; the CMS is fully
operational; security and backup mechanisms are in place; and all agreed deliverables have
been handed over.

---

## 15. Implementation phases

Follow in order. Each phase ends in something demonstrable and deployable.

| # | Phase | Contents |
|---|---|---|
| 1 | **Foundation** | Repo, TS config, Fastify bootstrap, `env.ts` validation, Prisma connection, universal response envelope, error handler, `pino` logger, health checks, Swagger. Docker Compose for local Postgres. |
| 2 | **Database** | Full `schema.prisma`, initial migration, hand-written tsvector trigger + GIN index migrations, seed script (super admin, default categories, settings). **Checkpoint — expensive to change later.** |
| 3 | **Auth** | Google OAuth start/callback, whitelist matching, session creation, refresh rotation with reuse detection, logout, RBAC guard, super-admin protection, audit logging. Demonstrable via Swagger. |
| 4 | **Media & S3** | Upload, `sharp` derivatives (thumb/medium/large/og + WebP), media library CRUD, folders, private-bucket presigning. |
| 5 | **Core content** | Categories, video categories, tags, posts (draft/publish/schedule, placement, slug + redirect-on-change), shared SEO field handling, `buildSeo()` and `buildJsonLd()`. **This phase establishes the SEO pattern every later module reuses — get it right here.** |
| 6 | **Research & authors** | Authors, co-author ordering, research CRUD, multi-file upload to the private bucket, PDF text extraction, gated view-URL endpoint, `ResearchView` logging. |
| 7 | **Gallery & video** | Segments with covers and descriptions, image upload + reorder + required alt text, YouTube ID parsing and auto-thumbnail, video detail pages. |
| 8 | **Site & engagement** | About page, hero slides, settings, contact (+ email notify, rate limit, captcha escalation), newsletter, comments, likes, view counts, dashboard stats and recent activity. |
| 9 | **Search & SEO surface** | Postgres FTS across posts/research/videos, sitemap index + paginated sitemaps, redirects API, preview tokens. **Public API frozen here.** |
| 10 | **Frontend** | Next.js public site against the finished API, then the admin CMS. |
| 11 | **Hardening & launch** | Backup cron verified with a **real restore test**, rate-limit tuning, Lighthouse + Rich Results validation, security headers, load sanity check, docs, admin training material. |

---

## 16. Reference: client document facts deliberately excluded

The client PDF contains a budget figure, a date, a cost table, and signature blocks. These
are **commercial, not engineering, inputs** and were explicitly excluded from scope by the
project owner. Do not treat them as constraints.

---

## 17. Assumptions requiring confirmation

These were reasoned to from the project owner's answers but not stated verbatim. Confirm
before they become costly:

1. **Staff authenticate with Google OAuth too** — there is no email/password fallback for
   admins or editors, only the whitelist match. If staff need a password fallback, `User`
   needs `passwordHash` back and the whitelist flow changes shape. **Cheap to change now,
   painful once there is data.**
2. **Canonical domain** is `radhakundah.com` with the API at `api.radhakundah.com`, cookie
   scoped to `.radhakundah.com`.
3. **Comment moderation** defaults to publish-immediately with admin hide/delete, and a
   setting to switch to hold-for-approval.
4. **Member sign-up is open** — anyone with a Google account can sign in and become a
   member. No admin approval of members.
5. **`BOTH` posts get one live URL** (`/articles/{slug}`) with `/blogs/{slug}`
   301-redirecting. If two live URLs are genuinely wanted, it is a one-line change but is
   not recommended.
6. **Gmail SMTP** is used only for transactional mail (contact notifications). It cannot
   send newsletters — the ~500/day cap and spam reputation make that unworkable.

---

## 18. First tasks for the implementing agent

1. Create a feature branch off `main` — do **not** commit to `main` directly.
2. Confirm the assumptions in §17 with the project owner before running the first
   migration.
3. Execute Phase 1, then Phase 2. Stop after Phase 2 for schema review before proceeding.
4. Keep every decision in §3 intact. If something in §3 appears to block progress, raise it
   rather than working around it.
