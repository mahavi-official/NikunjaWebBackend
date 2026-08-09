# Radhakundah Platform — Backend API

A modern, scalable REST API backend for the Radhakundah content hub — a CMS-driven platform for research publications, articles, blogs, media galleries, and YouTube videos.

## 📋 Overview

**Radhakundah Platform** is a comprehensive content management and delivery system built with:
- **Runtime:** Node.js + TypeScript
- **HTTP Framework:** Fastify
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** Google OAuth only (no passwords)
- **Storage:** AWS S3 (public CDN + private research PDFs)
- **Search:** PostgreSQL full-text search (tsvector + GIN indexes)
- **Deployment:** Stateless, horizontally scalable behind a load balancer

## 🎯 Project Scope

This repository contains **backend only**. The frontend (Next.js) is a separate deployment in a different repository, both sharing a parent domain for cookie-based session management.

## 📁 Architecture Overview

```
src/
├─ config/              # Environment validation, constants
├─ lib/                 # Shared utilities (errors, response, JWT, OAuth, S3, etc.)
├─ plugins/             # Fastify plugins (auth, RBAC, CORS, rate-limiting, etc.)
├─ modules/             # Feature modules (auth, posts, research, gallery, etc.)
│  ├─ auth/            # Google OAuth, session management
│  ├─ users/           # Staff + members, whitelisting
│  ├─ posts/           # Articles + blogs (unified model, split by placement)
│  ├─ research/        # Research papers, multi-file uploads, gated PDFs
│  ├─ gallery/         # Segments + images with required alt text
│  ├─ videos/          # YouTube integration
│  ├─ media/           # Upload, S3 management, image derivatives
│  ├─ engagement/      # Likes, comments, view counts
│  ├─ search/          # Full-text search
│  └─ [dashboard, contact, newsletter, seo, settings, pages, hero, categories, tags, authors, etc.]
├─ jobs/                # Background jobs (backup, audit log pruning)
├─ server.ts           # Fastify app builder
└─ index.ts            # Entry point, graceful shutdown

prisma/
├─ schema.prisma       # Complete data model (matching agent.md §6)
├─ seed.ts             # Initial data seeding
└─ migrations/         # Database migrations
```

## 🔐 Authentication & Authorization

### Google OAuth Only
- **No passwords anywhere** — every user (members, editors, admins, super admin) signs in via Google
- **Whitelisting flow:** Admin inserts a row with email + role + `WHITELISTED` status. On first Google sign-in, the email matches, `providerId` binds to Google's `sub`, and status becomes `ACTIVE`.
- **Members:** Auto-created on first Google sign-in with `MEMBER` role (CMS access blocked).
- **Staff:** Must be explicitly whitelisted; cannot self-register.

### Tokens
- **Access token:** JWT, 15-minute TTL, contains `{sub, role, editorModules}`
- **Refresh token:** Opaque 32 random bytes, hashed (SHA-256) in DB, 30-day TTL, rotated on every refresh
- **Rotation:** Reuse of an already-rotated token revokes the entire session family (security)
- **Cookie:** httpOnly, Secure, SameSite=Lax, domain-scoped to `.radhakundah.com`

### RBAC (Role-Based Access Control)
Four hardcoded roles (no editable permissions table):
- **SUPER_ADMIN:** Full access, protected from deletion/demotion, seeded at first boot
- **ADMIN:** Content CRUD + publish, staff management, audit logs (read-only)
- **EDITOR:** Content CRUD within assigned modules (`editorModules` array), own content only
- **MEMBER:** Browse published content, like/comment, view gated research PDFs

Per-module capabilities: View, Create, Edit, Delete, Publish, Unpublish.

## 📡 API Namespaces

All endpoints prefixed with `/api/v1`:

| Namespace | Auth | Cacheable | Purpose |
|-----------|------|-----------|---------|
| `/public/*` | none | yes | Published content only, CDN-friendly |
| `/auth/*` | mixed | no | OAuth, refresh, logout |
| `/me/*` | member+ | no | Profile, likes, comments, gated PDFs |
| `/admin/*` | staff | no | Full CMS (create/read/update/delete/publish) |

## 🗄️ Database Schema

**Highlights:**
- **Google OAuth only:** `AuthProvider { GOOGLE }`, no password fields anywhere
- **Content:** `Post` (articles + blogs, unified model), `Research`, `Gallery` (segments → images), `Video` (YouTube), `Page` (About singleton)
- **Taxonomy:** `Category` (scoped: ARTICLE/BLOG/RESEARCH), `Tag` (shared), `VideoCategory` (independent)
- **Authors:** Separate from `User`; supports co-authors with ordering and corresponding-author flag
- **Media:** Centralized S3 bucket management with CDN support
- **SEO:** Inline on every public entity (`metaTitle`, `metaDescription`, `ogImageId`, `noIndex`, etc.)
- **Full-text search:** `tsvector` columns on `Post` and `Research`, maintained by triggers, GIN indexes
- **Audit trail:** Every write action and auth event logged with actor, IP, entity, action
- **Sessions:** Hashed refresh tokens for true revocation

See `prisma/schema.prisma` for the complete model and `agent.md` §6 for design rationale.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker (optional, for `docker-compose postgres`)
- AWS S3 credentials (optional if running locally without file uploads)

### Installation

```bash
# Clone the repo
git clone https://github.com/mahavi-official/NikunjaWebBackend.git
cd NikunjaWebBackend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings (see "Environment Variables" section below)

# Start local Postgres (if using Docker)
docker compose up -d postgres
# Wait for healthcheck to pass

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data (super admin, categories, settings)
npm run db:seed

# Start dev server
npm run dev
```

Server boots at `http://localhost:4000` (or your configured `PORT`).

### Health Checks
- **Liveness:** `GET /health` → `{ status: "ok", timestamp }`
- **Readiness:** `GET /health/ready` → `{ status: "ready" }` (confirms DB connection)

### Swagger Documentation
Once the server is running, visit `http://localhost:4000/docs` for interactive API documentation.

## 📝 Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Environment
NODE_ENV=development
PORT=4000
LOG_LEVEL=info

# API & Site URLs
API_URL=http://localhost:4000
SITE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/radhakundah

# JWT & Auth
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-minimum-32-characters-long
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
COOKIE_DOMAIN=.localhost
COOKIE_SECURE=false

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback

# Super Admin (seeded on first run)
SUPER_ADMIN_EMAIL=admin@radhakundah.com
SUPER_ADMIN_NAME=Super Admin

# SMTP (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM="Radhakundah <no-reply@radhakundah.com>"
CONTACT_NOTIFY_TO=contact@radhakundah.com

# S3
S3_REGION=us-east-1
S3_BUCKET_PUBLIC=radhakundah-media
S3_BUCKET_PRIVATE=radhakundah-research
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_PUBLIC_BASE_URL=https://cdn.radhakundah.com
SIGNED_URL_TTL_SECONDS=60

# Backup
BACKUP_ENABLED=true
BACKUP_CRON=0 2 */3 * *
BACKUP_S3_BUCKET=radhakundah-backups
BACKUP_RETENTION_DAYS=90

# Security
RECAPTCHA_SECRET=
PREVIEW_TOKEN_TTL_MINUTES=30
```

**Note:** For local development without AWS S3, use placeholders for S3 variables; the app won't crash, only file uploads will fail gracefully.

## 📚 Development Workflow

### Scripts

```bash
npm run dev              # Start dev server with hot reload (tsx watch)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled server (dist/index.js)

npm run db:generate      # Generate Prisma client after schema changes
npm run db:migrate       # Create and apply a new migration
npm run db:seed          # Run seed script (idempotent)
npm run db:studio        # Launch Prisma Studio (visual DB browser)

npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm test                 # Run vitest unit tests
npm run test:coverage    # Generate coverage report
```

### Code Structure & Patterns

Every feature module follows **exactly four files** (agent.md §5):

```
src/modules/categories/
├─ categories.schema.ts      # Zod validation schemas
├─ categories.service.ts     # Business logic, Prisma queries
├─ categories.controller.ts  # HTTP ↔ service translation
└─ categories.routes.ts      # Route registration per namespace
```

**Request flow:**
```
HTTP request → route handler → controller → service → Prisma → DB
         ↓         ↓            ↓           ↓        ↓
      params/   envelope   translate    domain    data
      body    middleware   data types   logic     access
```

**Error handling:**
- Service throws typed `AppError` subclasses (`NotFoundError`, `ForbiddenError`, etc.)
- Error handler plugin catches them, formats to universal envelope: `{ success: false, error: { code, message, details } }`
- Stack traces never leave server in production

**Response envelope:**
- Success: `{ success: true, data, meta? }` where `meta` = pagination info if applicable
- Failure: `{ success: false, error: { code, message, details? } }`

### Adding a New Content Module

Use the `categories` module (simplest CRUD) as a reference template. To add a new module:

1. Create four files under `src/modules/newmodule/`
2. Define Zod schemas in `*.schema.ts`
3. Implement service class in `*.service.ts` (Prisma only, no HTTP concerns)
4. Implement controller functions in `*.controller.ts` (thin translation layer)
5. Export route-registration functions in `*.routes.ts` (one per namespace: public, me, admin)
6. Register in `server.ts`: `app.register(newmodulePublicRoutes, { prefix: ... })`

See `IMPLEMENTATION.md` for detailed examples.

## 🔍 Full-Text Search

PostgreSQL-native FTS with weighted ranking:
- **Title:** weight A (highest)
- **Excerpt/Abstract:** weight B
- **Body/Content/Extracted PDF text:** weight C (lowest)

Implemented via `tsvector` columns maintained by triggers on write. No external search engine (Meilisearch, Typesense, Elasticsearch) required.

Queries:
```bash
GET /api/v1/public/search?q=kubernetes&type=posts&page=1&limit=20
```

## 🖼️ SEO & Content Delivery

### Canonical URLs
Every published item has exactly one canonical URL per agent.md §3.1:
- Posts (ARTICLE or BOTH): `/articles/{slug}`
- Posts (BLOG): `/blogs/{slug}`
- Research: `/research/{slug}`
- Videos: `/videos/{slug}`
- Gallery segments: `/gallery/{slug}`
- Authors: `/authors/{slug}`

Posts with `placement = BOTH` appear in both article and blog listings, but `/blogs/{slug}` 301-redirects to `/articles/{slug}`, consolidating link equity.

### Metadata & Open Graph
Every detail endpoint returns a resolved `seo` object with fallbacks already applied:
```json
{
  "post": { ... },
  "seo": {
    "title": "Post Title",
    "description": "...",
    "canonical": "https://radhakundah.com/articles/my-post",
    "robots": "index,follow",
    "openGraph": {
      "title": "...",
      "description": "...",
      "image": "https://cdn.radhakundah.com/og-image.png",
      "type": "article",
      "url": "..."
    },
    "jsonLd": [ /* structured data */ ]
  },
  "breadcrumbs": [ ... ],
  "related": [ ... ]
}
```

### Sitemaps
- `/sitemap.xml` — index pointing to paginated sitemaps
- `/sitemaps/posts-1.xml`, `/sitemaps/research-1.xml`, etc. — 5,000 URLs per file
- Excludes unpublished, `noIndex`, and future-dated items
- Cached 1 hour

## 📦 Deployment

### Production Environment

1. **Environment variables:** Set all required env vars (see "Environment Variables" section) in your deployment platform (GitHub Actions secrets, AWS Parameter Store, etc.)

2. **Database migrations:** Run migrations as an explicit deployment step, **never** auto-apply at boot:
   ```bash
   npm run db:migrate -- --deploy  # or npx prisma migrate deploy
   ```

3. **Build & start:**
   ```bash
   npm run build
   npm start
   ```

4. **Reverse proxy:** Put Nginx/ALB in front with TLS termination, pointing to the backend on `localhost:4000`

5. **Backup:** `pg_dump` → gzip → S3 every 3 days, 90-day retention (automated via `node-cron` in the app)

6. **Monitoring:**
   - Health checks: `/health` (liveness), `/health/ready` (readiness)
   - Logs: structured JSON via pino, forward to your logging service
   - Audit trail: every CMS action and auth event in `AuditLog` table

### Scaling

The backend is **stateless** — sessions stored in Postgres, files in S3. Scale horizontally behind a load balancer with no changes.

## 📋 Project Status

### ✅ Completed
- **Phase 1:** Foundation (Fastify, config, plugins, health checks, Swagger)
- **Phase 2:** Database schema (complete Prisma schema matching spec)
- **Batch 0:** Cross-cutting fixes (crypto, error handling, plugin wrapping, ZodTypeProvider)

### 🚧 In Progress / TODO
- **Batch 1:** Shared utilities and core plugins
- **Batch 2:** Auth routes/controller, users module
- **Batch 3–10:** Content modules and SEO (see IMPLEMENTATION.md for full plan)

See `IMPLEMENTATION.md` for the detailed build plan.

## 📖 Documentation

- **`agent.md`** — Complete spec: design decisions, schema, endpoints, all 11 phases (1600+ lines)
- **`IMPLEMENTATION.md`** — Build plan, execution order, reference patterns, activities to date
- **`README.md`** (this file) — Project overview, getting started, deployment
- **`prisma/schema.prisma`** — Full data model with inline comments
- **Swagger UI** — Interactive API docs at `/docs` once server is running

## 🤝 Contributing

1. Create a feature branch off `main` (do not commit to `main` directly)
2. Follow the module pattern (four files per feature)
3. Run `npm run lint` and `npm run format` before committing
4. Write service-layer unit tests for branching logic
5. Test modules through Swagger UI before merging
6. Ensure `npm run build` and type-checking (`npx tsc --noEmit`) pass

## 📄 License

Proprietary — Nikunja Seva Pty Ltd & Mahavi Pvt Ltd.

---

**Built with:** Fastify, Prisma, PostgreSQL, TypeScript, Node.js  
**Deployed to:** AWS (or your infrastructure)  
**Questions or issues?** See `IMPLEMENTATION.md` for build status and contributor guide.
