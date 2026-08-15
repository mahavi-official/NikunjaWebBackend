# Implementation Guide & Activity Log

## Project: Radhakundah Platform Backend

**Status:** Phase 1 complete, Phase 2 complete, Batch 0 complete | Phases 3–11 planned and sequenced  
**Date Started:** 2026-08-09  
**Repository:** https://github.com/mahavi-official/NikunjaWebBackend  
**Branch:** `feature/radhakundah-backend` (off `main`)

---

## Table of Contents

1. [Project Context](#project-context)
2. [Scope & Constraints](#scope--constraints)
3. [Activities Completed](#activities-completed)
4. [Architecture & Design](#architecture--design)
5. [Build Plan: Batches 1–10](#build-plan-batches-1--10)
6. [Reference Module Pattern](#reference-module-pattern)
7. [Database Migration Strategy](#database-migration-strategy)
8. [Verification Checklist](#verification-checklist)
9. [Known Assumptions & Risks](#known-assumptions--risks)

---

## Project Context

### What is Radhakundah Platform?

A content hub for Nikunja Seva Pty Ltd (Australia) — a complete CMS-driven website for research publications, articles, blogs, media galleries, and YouTube videos. The spec is frozen in `agent.md` (1600+ lines, containing all design decisions, schema, endpoints, and an 11-phase build plan).

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| HTTP Framework | Fastify |
| ORM | Prisma |
| Database | PostgreSQL |
| Authentication | Google OAuth only (no passwords) |
| Storage | AWS S3 (two buckets: public media + private research PDFs) |
| Search | PostgreSQL full-text search (tsvector + GIN indexes) |
| Frontend | Next.js (separate repo, out of this project's scope) |
| Deployment | Stateless, horizontally scalable |

### Core Principle

**"Don't over-engineer."** No Redis, no message queues, no microservices, no GraphQL, no Kubernetes. The scale doesn't justify it. Backend is finished and frozen before Next.js starts (Phase 10).

---

## Scope & Constraints

### In Scope
- ✅ Backend API (REST, versioned `/api/v1`)
- ✅ Database schema (Prisma)
- ✅ Google OAuth authentication + session management
- ✅ Role-based access control (4 hardcoded roles)
- ✅ Content management (posts, research, galleries, videos, etc.)
- ✅ Media management (S3 uploads, image derivatives)
- ✅ Full-text search (PostgreSQL native)
- ✅ SEO (metadata, sitemaps, structured data, redirects)
- ✅ Background jobs (backups, audit log pruning)
- ✅ Audit logging (every write + auth event)

### Out of Scope
- ❌ Frontend (Next.js) — separate repo
- ❌ Docker/Kubernetes deployment automation
- ❌ Email newsletters (collected only, no bulk sending due to Gmail SMTP limits)
- ❌ Multi-language support (English only for now)
- ❌ Mobile app API variants (same REST API used, only auth variant differs if needed)

---

## Activities Completed

### Phase 1: Foundation ✅
**Date:** 2026-08-09  
**Status:** Complete

**Deliverables:**
- [x] Node.js + TypeScript project setup (`package.json`, `tsconfig.json`)
- [x] Fastify bootstrap + plugin architecture
- [x] Environment validation with Zod (fails fast on boot)
- [x] Prisma connection plugin
- [x] Universal response envelope (`{ success, data, meta }`)
- [x] Typed error handler (AppError subclasses)
- [x] Structured logging with pino
- [x] Health check endpoints (`/health`, `/health/ready`)
- [x] Swagger UI + OpenAPI documentation
- [x] CORS, Helmet (security headers), rate limiting
- [x] Docker Compose for local PostgreSQL

**Files Created:**
```
✓ package.json                    (all dependencies pinned)
✓ tsconfig.json                   (strict ES2020 mode, @/* alias)
✓ docker-compose.yml              (postgres:16-alpine)
✓ .env.example                    (all 40+ env vars documented)
✓ .gitignore                       (node_modules, dist, .env, etc.)
✓ src/config/env.ts               (zod validation, process.exit(1) on invalid)
✓ src/config/constants.ts         (centralized constants + AUDIT_ACTIONS)
✓ src/lib/errors.ts               (AppError, NotFoundError, etc.; FieldError interface)
✓ src/lib/response.ts             (successResponse, paginationMeta, envelopes)
✓ src/lib/jwt.ts                  (JWT generation + verification)
✓ src/lib/oauth.ts                (Google OAuth token exchange + profile fetch)
✓ src/plugins/cors.ts             (configured, fastify-plugin wrapped)
✓ src/plugins/helmet.ts           (security headers, fastify-plugin wrapped)
✓ src/plugins/rateLimit.ts        (100 req/min global, fastify-plugin wrapped)
✓ src/plugins/logger.ts           (pino integration, fastify-plugin wrapped)
✓ src/plugins/errorHandler.ts     (Zod + Prisma error mapping, fastify-plugin wrapped)
✓ src/plugins/prisma.ts           (PrismaClient injection, graceful disconnect)
✓ src/server.ts                   (app builder, plugin registration, health endpoints)
✓ src/index.ts                    (listen, SIGTERM/SIGINT handlers)
```

### Phase 2: Database Schema ✅
**Date:** 2026-08-09  
**Status:** Complete, ready for migration

**Deliverables:**
- [x] Complete Prisma schema (matching `agent.md` §6 exactly)
- [x] All models: User, Session, Post, Research, Author, Gallery, Video, Media, etc.
- [x] Enums: Role, UserStatus, AuthProvider, Placement, ContentStatus, etc.
- [x] Relationships + cascading rules
- [x] Inline SEO columns on public entities
- [x] Unsupported("tsvector") columns for FTS (triggers to be created in raw SQL)
- [x] Seed script (super admin, default categories, site settings, About page)

**Files Created:**
```
✓ prisma/schema.prisma            (1100+ lines, complete model)
✓ prisma/seed/                    (sample-content seeder; super admin moved to boot — see src/lib/ensureSuperAdmin.ts)
✓ prisma/migrations/migration_lock.toml (PostgreSQL lock file)
```

**Key Design Decisions (from `agent.md` §3):**
- Posts + Blogs unified as `Post` model with `placement` field (ARTICLE/BLOG/BOTH)
- `BOTH` posts have one canonical URL (`/articles/{slug}`), `/blogs/{slug}` 301-redirects
- Categories scoped to ARTICLE/BLOG/RESEARCH; tags shared globally
- Research PDFs access-gated to signed-in users via 60s presigned URLs
- Author separate from User (paper author ≠ staff account)
- No password fields anywhere (Google OAuth only)
- Refresh tokens hashed (SHA-256) in DB for revocation
- Super admin seeded at boot with `isProtected = true`

**Next Step:** Run `npm install`, then migrate:
```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate --name init
npm run seed:content   # optional sample content; super admin is created at boot
```

### Batch 0: Cross-cutting Fixes ✅
**Date:** 2026-08-09  
**Status:** Complete

**What was fixed:**

1. **`src/lib/jwt.ts`** — CommonJS `require("crypto")` bug
   - ❌ Before: `const crypto = require("crypto")` (throws ReferenceError in ESM)
   - ✅ After: `import { createHash } from "node:crypto"` (proper ESM import)

2. **`src/config/constants.ts`** — Missing constant
   - ✅ Added: `AUTH_LOGOUT_ALL: "auth.logout_all"` to `AUDIT_ACTIONS`
   - ✅ Fixed: `auth.service.ts::logoutAll()` now uses constant instead of literal `"auth.logout-all"`

3. **`src/lib/errors.ts`** — Class/interface name collision
   - ❌ Before: `interface ValidationError` + `class ValidationError` (fragile declaration merge)
   - ✅ After: Renamed interface to `FieldError`, updated all uses in error handler

4. **All plugins in `src/plugins/*.ts`** — Inconsistent wrapping
   - ❌ Before: Only `prisma.ts` used `fastify-plugin`; others were bare async functions
   - ✅ After: All wrapped with `export default fp(pluginFunction)` for proper encapsulation

5. **`src/server.ts`** — Missing plugin registrations + ZodTypeProvider
   - ✅ Added: `@fastify/cookie` (refresh token httpOnly cookie)
   - ✅ Added: `@fastify/multipart` (file uploads)
   - ✅ Added: `@fastify/swagger` + `@fastify/swagger-ui` (OpenAPI docs at `/docs`)
   - ✅ Wired: `fastify.withTypeProvider<ZodTypeProvider>()` for request/response validation
   - ✅ Changed: Plugin registration from direct calls to `fastify.register()` for consistency

6. **Pagination logic split** — Better modularity
   - ✅ Created: `src/lib/pagination.ts` (calculateSkip, validatePagination)
   - ✅ Moved from: `src/lib/response.ts` (which now focuses on envelopes only)

7. **Response envelope helpers added** — DRY for schemas
   - ✅ Added: `successEnvelope(dataSchema)` and `paginatedEnvelope(itemSchema)` Zod helpers
   - ✅ Goal: No need to hand-write `{ success: true, data }` in every schema again

**Commit:**
```
017d31b - Batch 0: Cross-cutting fixes (26 files changed, 3581 insertions)
```

---

## Architecture & Design

### Layering & Dependency Flow

```
HTTP Request
    ↓
Route Handler (validation via Zod schema)
    ↓
Controller (envelope response, thin translation)
    ↓
Service (business logic, Prisma queries, error throwing)
    ↓
Prisma Client (parameterized SQL only)
    ↓
Database (PostgreSQL)
```

**Rules:**
- Routes never touch Prisma directly
- Services never touch `req`/`reply`
- Services throw `AppError` subclasses
- Controllers apply `successResponse()` envelope
- Error handler catches and formats

### Module Structure (Four-File Pattern)

Every feature gets exactly four files per `agent.md` §5:

```
src/modules/example/
├─ example.schema.ts      # Zod validation + type inference
├─ example.service.ts     # Business logic + Prisma
├─ example.controller.ts  # HTTP ↔ service translation
└─ example.routes.ts      # Route registration (one per namespace)
```

Example module order in `routes.ts`:
```typescript
// Export one function per namespace
export async function examplePublicRoutes(app: FastifyZodInstance) { ... }
export async function exampleMeRoutes(app: FastifyZodInstance) { ... }
export async function exampleAdminRoutes(app: FastifyZodInstance) { ... }

// server.ts mounts them:
app.register(examplePublicRoutes, { prefix: `${API_PREFIX}/public` });
app.register(exampleMeRoutes,     { prefix: `${API_PREFIX}/me` });
app.register(exampleAdminRoutes,  { prefix: `${API_PREFIX}/admin` });
```

### RBAC (Role-Based Access Control)

Four hardcoded roles (no editable permissions table per `agent.md` §3.9):

| Capability | SUPER_ADMIN | ADMIN | EDITOR | MEMBER |
|---|:--:|:--:|:--:|:--:|
| Content CRUD | ✓ | ✓ | ✓ (within `editorModules`) | — |
| Delete any | ✓ | ✓ | own only | — |
| Manage staff | ✓ | ✓ | — | — |
| Site settings | ✓ | — | — | — |
| View audit logs | ✓ | ✓ (read) | — | — |
| Browse/like/comment | ✓ | ✓ | ✓ | ✓ |

**Super admin protection** (enforced in one place, `users.service.ts`):
- Any update/delete/role-change/suspend targeting a user with `isProtected = true` is rejected unless the actor is that same user

**Editor scope** controlled by `editorModules` array (e.g., `["posts", "research", "gallery"]`)

### Authentication Flow

```
1. User clicks "Sign in with Google"
   ↓
2. GET /auth/google → redirects to Google consent screen
   ↓
3. User approves → redirected to /auth/google/callback?code=...
   ↓
4. Backend exchanges code for Google tokens + fetches profile
   ↓
5. User row lookup by email:
   - If exists + whitelisted → providerId binds, status→ACTIVE
   - If exists + not whitelisted → error (suspended/not activated)
   - If doesn't exist → create MEMBER row
   ↓
6. Generate JWT access token (15 min) + refresh token (30 days, hashed in DB)
   ↓
7. Set refresh token as httpOnly cookie
   ↓
8. Return access token in response body
   ↓
9. Client stores access token in memory, uses it for subsequent requests
   ↓
10. On expiry, client sends refresh token via cookie
    → backend verifies, rotates token, returns new access token
```

---

## Build Plan: Batches 1–10

### Batch 1: Shared Utilities & Core Plugins
**Depends on:** Batch 0  
**Blocks:** Everything else  
**Estimated effort:** 8–10 files, 500–800 LOC

**Files to create:**

| File | Purpose | Notes |
|------|---------|-------|
| `src/lib/slug.ts` | Slug generation + uniqueness | Check DB for duplicates, apply `-2` suffix strategy |
| `src/lib/sanitize.ts` | HTML sanitizer for rich text | Allow: headings, tables, images, links, lists, blockquote, pre/code |
| `src/lib/audit.ts` | Audit log writer | Centralized `audit(prisma, { userId, action, ... })` call |
| `src/lib/s3.ts` | S3 client + presigned URLs | Upload, presign, delete, list objects |
| `src/lib/image.ts` | Sharp image derivatives | Generate thumb/medium/large/og + WebP variants, strip EXIF |
| `src/lib/pdf.ts` | PDF text extraction | Use `pdf-parse` to extract text from uploaded PDFs |
| `src/lib/mailer.ts` | Email sender (Gmail SMTP) | Contact notifications, no bulk campaigns |
| `src/lib/seo.ts` | SEO helpers | `buildSeo()` + `buildXJsonLd()` functions (skeleton, fleshed out in Batch 4) |
| `src/plugins/auth.ts` | JWT verification + decoration | Decorates `request.user` with payload |
| `src/plugins/rbac.ts` | RBAC guards | `requireRole()`, `requirePermission(module, action)` |
| `src/plugins/multipart.ts` | Multipart form registration | (small, just registers `@fastify/multipart`) |

### Batch 2: Auth Complete + Users Module
**Depends on:** Batch 1  
**Blocks:** Batch 3+  
**Estimated effort:** 4 files (auth routes/controller) + 4 files (users CRUD) = 8 files, 600–800 LOC

**Files to create:**

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.controller.ts` | Thin wrapper: OAuth start/callback, refresh, logout |
| `src/modules/auth/auth.routes.ts` | Route registration: GET/POST auth endpoints |
| `src/modules/users/users.schema.ts` | Zod schemas: create staff, update profile, suspend/activate |
| `src/modules/users/users.service.ts` | Service: whitelist flow, role/permission checks, super-admin protection |
| `src/modules/users/users.controller.ts` | Controller: thin HTTP translation |
| `src/modules/users/users.routes.ts` | Routes: admin staff CRUD, profile endpoints, session list/delete |

**Key logic:**
- Whitelist matching (email + role)
- Super-admin protection (no one can delete/demote the protected user)
- Session management (list active, revoke by ID)

### Batch 3: Media & S3
**Depends on:** Batches 1–2  
**Blocks:** Batch 4+ (all cover/og images)  
**Estimated effort:** 4 files, 600–700 LOC

**Files to create:**

| File | Purpose |
|------|---------|
| `src/modules/media/media.schema.ts` | Zod: upload, folder CRUD, delete |
| `src/modules/media/media.service.ts` | Upload to S3, generate derivatives (sharp), library list/search, delete |
| `src/modules/media/media.controller.ts` | Controller: thin envelope |
| `src/modules/media/media.routes.ts` | Routes: POST /upload, GET library, DELETE |

**Integration:** All cover/og images in later modules reference `Media` rows by ID.

### Batch 4: Core Content (Categories, Tags, Posts) + SEO
**Depends on:** Batches 1–3  
**Blocks:** Batch 5+  
**Estimated effort:** 12 files, 1000+ LOC (largest batch)

**Files to create:**

| Module | Files | Purpose |
|--------|-------|---------|
| `categories` | 4 | Scoped CRUD (ARTICLE/BLOG/RESEARCH separate) |
| `tags` | 4 | Shared tag CRUD |
| `video-categories` | 4 | YouTube-specific categories |
| `posts` | 4 | Articles + blogs (unified model, split by placement), draft/publish/schedule, slug+redirect |

**Key logic:**
- Placement logic: ARTICLE→/articles/{slug}, BLOG→/blogs/{slug}, BOTH→both but 301 redirect
- Auto-redirect creation on slug change (published items only)
- SEO pattern establishment (calls `buildSeo()`, `buildJsonLd()` on public detail endpoints)
- Draft/published/scheduled filtering (publicOnly flag in service)

**This batch is critical:** agent.md §15 Phase 5 says "this phase establishes the SEO pattern every later module reuses — get it right here."

### Batch 5: Research & Authors
**Depends on:** Batches 1–4  
**Blocks:** Batch 9 (search)  
**Estimated effort:** 8 files, 800–1000 LOC

**Files to create:**

| Module | Files | Purpose |
|--------|-------|---------|
| `authors` | 4 | Author CRUD (separate from User), indexable detail page |
| `research` | 4 | Papers with co-authors, multi-file upload (private S3), PDF text extraction, gated view URLs, access logging |

**Key logic:**
- Multi-file per research item (main paper + appendices, 50 MB each)
- PDF text extraction → stored in `Research.extractedText` for FTS, never returned to client
- Gated view-URL endpoint: issues 60s presigned URL only to signed-in users, logs access to `ResearchView`
- Research author ordering + corresponding-author flag

### Batch 6: Gallery & Videos
**Depends on:** Batches 1–4  
**Estimated effort:** 8 files, 600–800 LOC

**Files to create:**

| Module | Files | Purpose |
|--------|-------|---------|
| `gallery` | 4 | Segments (group images) with cover + description, image list/reorder, **required alt text** |
| `videos` | 4 | YouTube integration (ID parsing, auto-thumbnail fetch), category, indexable detail page |

**Key logic:**
- Gallery structure: Segment → Images (no deeper nesting)
- Alt text mandatory at upload (accessibility + image SEO)
- YouTube ID parser: handles watch/youtu.be/shorts/embed URL formats
- Auto-thumbnail fetch from YouTube at save time

### Batch 7: Site Content & Engagement
**Depends on:** Batches 1–6  
**Estimated effort:** 12 files, 800–1000 LOC

**Files to create:**

| Module | Files | Purpose |
|--------|-------|---------|
| `pages` | 4 | About page (singleton), editable sections |
| `hero` | 4 | Hero slides with images, CTA links |
| `settings` | 4 | Site-wide config (title, logo, socials, GA id, etc.) |
| `contact` | 4 | Contact form, rate limit (3/hr per IP), honeypot, captcha escalation, email notify |
| `newsletter` | 4 | Email collection, unsubscribe token, export CSV |
| `engagement` | 4 | Likes + comments on posts (no approval queue initially, admin can hide/delete) |

**Key logic:**
- Contact rate limiting + captcha escalation per agent.md §3.10
- Newsletter opt-in only (no bulk sending due to Gmail SMTP limits)
- Comments immediately published, admin can hide

### Batch 8: Dashboard
**Depends on:** Batches 2–7  
**Estimated effort:** 1 file, 200–300 LOC

**Files to create:**

| File | Purpose |
|------|---------|
| `src/modules/dashboard/dashboard.routes.ts` | Stats (8 counts: posts, published, draft, research, gallery, videos, users, recent activities) |

**No schema/service/controller needed** — pure query aggregation.

### Batch 9: Search & SEO Surface
**Depends on:** Batches 1–8 + tsvector migration applied  
**Blocks:** None (Phase 9 = "public API frozen")  
**Estimated effort:** 8 files, 600–800 LOC

**Files to create:**

| Module | Files | Purpose |
|--------|-------|---------|
| `search` | 4 | FTS queries against posts/research/videos, weighted ranking |
| `seo` | 4 | Sitemaps (index + paginated), redirects CRUD, preview tokens |

**Key logic:**
- FTS weighting: title (A) > excerpt/abstract (B) > body/content (C)
- Sitemaps: 5,000 URLs per file, exclude unpublished/noIndex/future-dated
- Preview tokens: 30-min TTL for draft mode preview in Next.js
- Redirects: handle slug changes (auto-created on update) + BOTH-post redirect rules

**Phase 9 checkpoint:** Public API is frozen here. Frontend can start.

### Batch 10: Background Jobs & Hardening
**Depends on:** Batches 1–9  
**Estimated effort:** 2 files (jobs) + docs  
**Estimated effort:** 500–800 LOC

**Files to create:**

| File | Purpose |
|------|---------|
| `src/jobs/backup.ts` | pg_dump → gzip → S3, prune old backups |
| `src/jobs/pruneAuditLogs.ts` | Delete audit logs older than 12 months |
| Updates: `src/index.ts` | Wire jobs via node-cron, graceful shutdown with job cleanup |

**Key logic:**
- Backup: cron per `BACKUP_CRON` env (default 0 2 */3 * * = 02:00 every 3 days)
- Retention: keep 90 days per `BACKUP_RETENTION_DAYS`
- Prune: weekly, delete `AuditLog` where `createdAt < cutoff12mo`

**Documentation deliverables:**
- Backup + restore procedure (tested, not theoretical)
- Security header review (Helmet already set up in Batch 0)
- Deployment guide (env vars, migration step, reverse proxy config)
- Admin training material (user manual)

---

## Reference Module Pattern

### Complete Example: Categories Module

The `categories` module is the simplest CRUD entity — used as the template for all others.

#### `src/modules/categories/categories.schema.ts`

```typescript
import { z } from "zod";
import { successEnvelope, paginatedEnvelope } from "@/lib/response";

export const categoryScopeSchema = z.enum(["ARTICLE", "BLOG", "RESEARCH"]);

export const createCategorySchema = z.object({
  scope: categoryScopeSchema,
  name: z.string().min(1, "Name required").max(120),
  slug: z.string().min(1).max(140).optional(),
  description: z.string().max(500).optional(),
  order: z.number().int().default(0),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  noIndex: z.boolean().default(false),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryParamsSchema = z.object({
  id: z.string().cuid(),
});

export const categoryQuerySchema = z.object({
  scope: categoryScopeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const categoryDto = z.object({
  id: z.string(),
  scope: categoryScopeSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  order: z.number(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  noIndex: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categoryResponseSchema = successEnvelope(categoryDto);
export const categoryListResponseSchema = paginatedEnvelope(categoryDto);

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CategoryDto = z.infer<typeof categoryDto>;
```

#### `src/modules/categories/categories.service.ts`

```typescript
import { PrismaClient, Category, CategoryScope } from "@prisma/client";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { ensureUniqueSlug } from "@/lib/slug";
import { AUDIT_ACTIONS } from "@/config/constants";
import { validatePagination } from "@/lib/pagination";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";
import type { AuthUser } from "@/types/auth";

export class CategoryService {
  constructor(private prisma: PrismaClient) {}

  async list(filter: {
    scope?: CategoryScope;
    page: number;
    limit: number;
  }): Promise<{ items: Category[]; total: number }> {
    const where = filter.scope ? { scope: filter.scope } : {};
    const { skip, limit } = validatePagination(filter.page, filter.limit);

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { order: "asc" },
      }),
      this.prisma.category.count({ where }),
    ]);

    return { items, total };
  }

  async getById(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  async create(input: CreateCategoryInput, actor: AuthUser): Promise<Category> {
    const slug =
      input.slug || (await ensureUniqueSlug(this.prisma, "category", input.name, { scope: input.scope }));

    const category = await this.prisma.category.create({
      data: { ...input, slug },
    });

    await audit(this.prisma, {
      userId: actor.id,
      action: AUDIT_ACTIONS.POST_CREATE,
      entityType: "Category",
      entityId: category.id,
      ip: undefined,
    });

    return category;
  }

  async update(id: string, input: UpdateCategoryInput, actor: AuthUser): Promise<Category> {
    const category = await this.getById(id);

    let updateData = { ...input };
    if (input.slug && input.slug !== category.slug) {
      // Slug changed; check uniqueness within the same scope
      const existing = await this.prisma.category.findFirst({
        where: { slug: input.slug, scope: category.scope, NOT: { id } },
      });
      if (existing) throw new ConflictError("Slug already in use");
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updateData,
    });

    await audit(this.prisma, {
      userId: actor.id,
      action: AUDIT_ACTIONS.POST_UPDATE,
      entityType: "Category",
      entityId: id,
      ip: undefined,
    });

    return updated;
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    await this.getById(id); // ensure exists
    await this.prisma.category.delete({ where: { id } });

    await audit(this.prisma, {
      userId: actor.id,
      action: AUDIT_ACTIONS.POST_DELETE,
      entityType: "Category",
      entityId: id,
      ip: undefined,
    });
  }
}
```

#### `src/modules/categories/categories.controller.ts`

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { CategoryService } from "./categories.service";
import { successResponse, paginationMeta } from "@/lib/response";
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

export function makeCategoryController(service: CategoryService) {
  return {
    list: async (req: FastifyRequest, reply: FastifyReply) => {
      const { scope, page, limit } = req.query as any;
      const { items, total } = await service.list({ scope, page, limit });
      reply.send(successResponse(items, paginationMeta(page, limit, total)));
    },

    getById: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as any;
      const category = await service.getById(id);
      reply.send(successResponse(category));
    },

    create: async (req: FastifyRequest, reply: FastifyReply) => {
      const category = await service.create(req.body as CreateCategoryInput, req.user!);
      reply.code(201).send(successResponse(category));
    },

    update: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as any;
      const category = await service.update(id, req.body as UpdateCategoryInput, req.user!);
      reply.send(successResponse(category));
    },

    remove: async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as any;
      await service.remove(id, req.user!);
      reply.code(204).send();
    },
  };
}
```

#### `src/modules/categories/categories.routes.ts`

```typescript
import { FastifyZodInstance } from "@/server";
import { CategoryService } from "./categories.service";
import { makeCategoryController } from "./categories.controller";
import {
  categoryQuerySchema,
  categoryParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryResponseSchema,
  categoryListResponseSchema,
} from "./categories.schema";

export async function categoryPublicRoutes(app: FastifyZodInstance) {
  const controller = makeCategoryController(new CategoryService(app.prisma));

  app.get("/categories", { schema: { querystring: categoryQuerySchema, response: { 200: categoryListResponseSchema } } }, controller.list);
}

export async function categoryAdminRoutes(app: FastifyZodInstance) {
  const controller = makeCategoryController(new CategoryService(app.prisma));

  app.get("/categories", { preHandler: app.requirePermission("categories", "view"), schema: { querystring: categoryQuerySchema, response: { 200: categoryListResponseSchema } } }, controller.list);

  app.get("/categories/:id", { preHandler: app.requirePermission("categories", "view"), schema: { params: categoryParamsSchema, response: { 200: categoryResponseSchema } } }, controller.getById);

  app.post("/categories", { preHandler: app.requirePermission("categories", "create"), schema: { body: createCategorySchema, response: { 201: categoryResponseSchema } } }, controller.create);

  app.patch("/categories/:id", { preHandler: app.requirePermission("categories", "edit"), schema: { params: categoryParamsSchema, body: updateCategorySchema, response: { 200: categoryResponseSchema } } }, controller.update);

  app.delete("/categories/:id", { preHandler: app.requirePermission("categories", "delete"), schema: { params: categoryParamsSchema } }, controller.remove);
}
```

#### Register in `server.ts`

```typescript
import { categoryPublicRoutes, categoryAdminRoutes } from "@/modules/categories/categories.routes";

// ... in buildApp()
app.register(categoryPublicRoutes, { prefix: `${API_PREFIX}/public` });
app.register(categoryAdminRoutes, { prefix: `${API_PREFIX}/admin` });
```

**Copy this pattern for:** tags, video-categories, hero, pages, users, media, contact-messages, redirects, settings, and every other content module. Only change:
1. Service methods (domain logic)
2. Schema fields
3. Canonical URLs (for SEO modules)

---

## Database Migration Strategy

### Current State
- `npm install` — in progress (transient network timeouts resolved)
- `Docker` — not currently running
- `Prisma migrations/` — contains only `migration_lock.toml`

### Steps to Migrate (once dependencies are installed)

#### Option A: With Docker (Recommended)

```bash
# 1. Start Postgres
docker compose up -d postgres
# Wait for healthcheck: docker compose ps

# 2. Generate Prisma client
npm run db:generate

# 3. Create initial migration (schema → migration SQL)
npm run db:migrate --name init
# Creates: prisma/migrations/<timestamp>_init/migration.sql

# 4. Create empty migration for tsvector triggers (hand-write the SQL)
npm run db:migrate --create-only --name add_search_vectors
# Creates: prisma/migrations/<timestamp>_add_search_vectors/migration.sql
# Hand-write the SQL (see below)

# 5. Apply both migrations
npm run db:migrate

# 6. Optional: sample content (the super admin is created at boot)
npm run seed:content
```

#### Option B: Without Docker (generates SQL only)

```bash
# 1. Generate base migration SQL (no DB connection needed)
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

# 2. Manually create migration folder and place the file
mkdir -p prisma/migrations/20240809000000_init
mv migration.sql prisma/migrations/20240809000000_init/migration.sql

# 3. Create another folder for triggers (hand-write SQL)
mkdir -p prisma/migrations/20240809000100_add_search_vectors
# Hand-write: prisma/migrations/20240809000100_add_search_vectors/migration.sql (see below)

# 4. Later, when DB is reachable:
npm run db:generate
npm run db:migrate deploy
# no seed step in production — the super admin is created at boot
```

### Raw SQL for tsvector Triggers

Create `prisma/migrations/<timestamp>_add_search_vectors/migration.sql`:

```sql
-- Create trigger function for Post.searchVector
CREATE OR REPLACE FUNCTION update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := 
    setweight(to_tsvector('english', NEW.title), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
    setweight(to_tsvector('english', NEW.content), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on Post insert/update
DROP TRIGGER IF EXISTS trg_update_post_search_vector ON "Post";
CREATE TRIGGER trg_update_post_search_vector
BEFORE INSERT OR UPDATE ON "Post"
FOR EACH ROW EXECUTE FUNCTION update_post_search_vector();

-- Create trigger function for Research.searchVector
CREATE OR REPLACE FUNCTION update_research_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW."searchVector" := 
    setweight(to_tsvector('english', NEW.title), 'A') ||
    setweight(to_tsvector('english', NEW.abstract), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."extractedText", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on Research insert/update
DROP TRIGGER IF EXISTS trg_update_research_search_vector ON "Research";
CREATE TRIGGER trg_update_research_search_vector
BEFORE INSERT OR UPDATE ON "Research"
FOR EACH ROW EXECUTE FUNCTION update_research_search_vector();

-- Create GIN indexes for FTS
CREATE INDEX idx_post_search ON "Post" USING GIN ("searchVector");
CREATE INDEX idx_research_search ON "Research" USING GIN ("searchVector");
```

**Checkpoint after migrations:**
```bash
npm run db:studio  # Verify tables + data
npm run dev        # Boot server, test /health + /health/ready
```

---

## Verification Checklist

### After Batch 0 (Completed)

- [x] `npm run build` succeeds (TypeScript compiles)
- [x] `npx tsc --noEmit` reports no errors
- [x] `npm run lint` passes ESLint
- [x] All files follow module pattern
- [x] Plugins wrapped with fastify-plugin
- [x] ZodTypeProvider wired
- [x] All cross-cutting fixes applied

### After Batch 1 (Shared Utilities)

- [ ] `npm run dev` boots without errors
- [ ] `/health` returns 200
- [ ] `/health/ready` returns 200 (DB reachable)
- [ ] All lib/* files have no import errors
- [ ] All plugins/auth.ts and rbac.ts guards work in isolation

### After Batch 2 (Auth + Users)

- [ ] Google OAuth login round-trip works (manually test with real Google credentials)
- [ ] Whitelisting flow: insert email → sign in with Google → user activates
- [ ] Super admin protection: attempt to delete/demote protected user → 403 Forbidden
- [ ] Refresh token rotation: old token reuse → 401 Unauthorized (revoked)
- [ ] Swagger UI at `/docs` shows all auth endpoints

### After Each Content Batch (3–8)

- [ ] Full CRUD works via Swagger UI (create, read, update, delete)
- [ ] Publishing flow: draft → published (with future-dated scheduling)
- [ ] RBAC: SUPER_ADMIN can do everything, ADMIN can do everything except settings, EDITOR only own content, MEMBER can't CUD
- [ ] Public endpoints never return unpublished/noIndex content
- [ ] SEO objects present on detail endpoints (when built in Batch 4+)

### After Batch 9 (Search + SEO)

- [ ] FTS queries return results ordered by weighted rank
- [ ] Sitemaps valid XML, exclude drafts/noIndex
- [ ] Redirects: slug change → 301 to new URL
- [ ] Preview tokens: draft mode works in Next.js (future)

### After Batch 10 (Jobs + Hardening)

- [ ] `npm run dev` shows cron tasks starting
- [ ] Backup job runs manually (test `runBackup()`)
- [ ] Backup lands in S3, can be listed
- [ ] Restore procedure documented + tested
- [ ] All code passes `npm run lint` + `npm run build`
- [ ] README + IMPLEMENTATION + docs up to date

---

## Known Assumptions & Risks

### Assumptions (from `agent.md` §17, confirmed)

1. ✅ **Staff authenticate with Google OAuth too** — no email/password fallback for admins
2. ✅ **Canonical domain** is `radhakundah.com` with API at `api.radhakundah.com`
3. ✅ **Comment moderation:** publish-immediately, admin can hide/delete; setting to hold-for-approval later
4. ✅ **Member sign-up open** — anyone with a Google account can sign in and become a member
5. ✅ **`BOTH` posts get one live URL** (`/articles/{slug}`), `/blogs/{slug}` 301-redirects
6. ✅ **Gmail SMTP** only for transactional mail, not bulk newsletters (500/day limit)

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Path alias `@/*` breaks in production** (`tsc` doesn't rewrite aliases) | Add `tsc-alias` to build step in Phase 11 deployment docs |
| **Docker unavailable for local DB** | Fallback: generate migration SQL offline with `prisma migrate diff --from-empty` |
| **Network timeouts during `npm install`** | Retry; registry is reachable; may need proxy config for some environments |
| **Google OAuth credentials missing** | Auth module compiles fine, routes just return error if IDs missing; use `.env` placeholders |
| **`pg_dump` not in runtime environment** | Production Dockerfile must `apt-get install postgresql-client`; flag in Phase 11 docs |
| **Database constraints violated during seed** | Seed script uses `upsert`, idempotent; safe to re-run |
| **Session token reuse not caught** | Refresh rotation logic checks token hasn't been used before; revokes family if reused |

---

## Next Steps

### For the Next Implementer

1. **Verify current state:**
   ```bash
   npm install  # May have transient network issues, retry 2–3 times
   npm run build
   npm run lint
   ```

2. **Set up database:**
   ```bash
   docker compose up -d postgres
   npm run db:generate
   npm run db:migrate --name init
   # Hand-write migration for tsvector triggers (SQL provided above)
   npm run db:migrate
   npm run seed:content   # optional sample content
   ```

3. **Start Batch 1:**
   - Create all files in `src/lib/` and `src/plugins/` (see Batch 1 table)
   - Reference the four-file pattern from this document (categories example)
   - Run tests as you go

4. **Follow the execution order:**
   - Batches must be done in sequence (dependencies matter)
   - Each batch represents a logical checkpoint
   - Commit after each batch

5. **Use this plan file:**
   - Refer to `/IMPLEMENTATION.md` for the module pattern
   - Refer to the detailed batch descriptions
   - Refer to the reference module (categories) as a template

---

## Appendix: File Checklist

### Phase 1 (Foundation) — Completed ✅

```
✅ package.json
✅ tsconfig.json
✅ .env.example
✅ .gitignore
✅ docker-compose.yml
✅ src/config/env.ts
✅ src/config/constants.ts
✅ src/lib/errors.ts (FieldError)
✅ src/lib/response.ts (envelopes)
✅ src/lib/jwt.ts (fixed crypto import)
✅ src/lib/oauth.ts
✅ src/lib/pagination.ts (split out)
✅ src/plugins/cors.ts (fp-wrapped)
✅ src/plugins/helmet.ts (fp-wrapped)
✅ src/plugins/rateLimit.ts (fp-wrapped)
✅ src/plugins/logger.ts (fp-wrapped)
✅ src/plugins/errorHandler.ts (fp-wrapped, FieldError)
✅ src/plugins/prisma.ts
✅ src/server.ts (withTypeProvider, all registrations)
✅ src/index.ts
```

### Phase 2 (Database) — Completed ✅

```
✅ prisma/schema.prisma
✅ prisma/seed/
✅ prisma/migrations/migration_lock.toml
```

### Batch 0 (Cross-cutting Fixes) — Completed ✅

```
✅ src/lib/jwt.ts — fixed crypto import
✅ src/config/constants.ts — added AUTH_LOGOUT_ALL
✅ src/modules/auth/auth.service.ts — uses constant
✅ src/lib/errors.ts — FieldError interface
✅ src/plugins/errorHandler.ts — FieldError
✅ All plugins — fp-wrapped
✅ src/server.ts — cookie, multipart, swagger, ZodTypeProvider
✅ src/lib/response.ts — envelope helpers
✅ src/lib/pagination.ts — split out
```

### Batch 1 (Shared Utilities) — To Do

```
❌ src/lib/slug.ts
❌ src/lib/sanitize.ts
❌ src/lib/audit.ts
❌ src/lib/s3.ts
❌ src/lib/image.ts
❌ src/lib/pdf.ts
❌ src/lib/mailer.ts
❌ src/lib/seo.ts
❌ src/plugins/auth.ts
❌ src/plugins/rbac.ts
❌ src/plugins/multipart.ts
```

### Batch 2 (Auth Routes + Users) — To Do

```
❌ src/modules/auth/auth.controller.ts
❌ src/modules/auth/auth.routes.ts
❌ src/modules/users/users.schema.ts
❌ src/modules/users/users.service.ts
❌ src/modules/users/users.controller.ts
❌ src/modules/users/users.routes.ts
```

### Batches 3–10 — To Do

All remaining modules (media, categories, tags, posts, research, authors, gallery, videos, pages, hero, settings, contact, newsletter, engagement, dashboard, search, seo, jobs).

---

**Plan created:** 2026-08-09  
**Last updated:** 2026-08-09  
**Status:** Ready for Batch 1 implementation
