# Radhakundah Platform — Backend API

REST API for the Radhakundah content hub: research publications, articles and blogs, image galleries, and YouTube videos. Backend only — the Next.js frontend is a separate deployment sharing a parent domain so the session cookie works across both.

**Stack:** Node.js + TypeScript · Fastify · Prisma · PostgreSQL · Google OAuth (no passwords) · Azure Blob Storage (public media + private research PDFs) · Postgres full-text search

Interactive API docs live at `/docs` once the server is running. They are generated from the route schemas, so they are always current — this file covers what the docs can't: setup, the security model, and the shape of the codebase.

## Quick start

```bash
cp .env.example .env          # fill in the values, see "Configuration"
docker compose up -d postgres # or point DATABASE_URL at your own

npm install                   # postinstall migrates the db and seeds sample
                               # content automatically, on first run only
npm run dev                   # http://localhost:4000
```

`postinstall` and `predev` both run `scripts/bootstrap-db.ts`: it applies pending
Prisma migrations, then seeds sample content the first time only (skipped if
already seeded, if `NODE_ENV=production`, or if `DATABASE_URL` isn't set yet —
it never fails the install). Re-seed or wipe sample content manually anytime
with `npm run seed:content` / `npm run seed:content:clean`.

Health probes: `GET /health` (liveness, no DB) and `GET /health/ready` (runs `SELECT 1`, answers 503 while Postgres is unreachable).

## Configuration

Every variable is listed with a working default in **`.env.example`**, and `src/config/env.ts` validates them at startup — the process refuses to boot if one is missing or malformed. Rather than repeat the list here, the ones that need a decision:

| Variable | Why it matters |
|---|---|
| `SUPER_ADMIN_EMAIL` / `_NAME` | The account created at every boot. Use a Google address you control — sign-in is OAuth only. |
| `COOKIE_DOMAIN`, `COOKIE_SECURE` | Must cover both frontend and API hosts (`.radhakundah.com`). Locally use `.localhost` and `false`. |
| `SITE_URL` | Where the OAuth callback redirects after sign-in, and the base for canonical URLs and sitemaps. |
| `JWT_ACCESS_SECRET` | 32 characters minimum, enforced. |
| `AZURE_STORAGE_*` | Placeholders are fine locally; only uploads and PDF downloads fail without real ones. |
| `RECAPTCHA_SECRET` | Optional. Left empty, the contact form falls back to its honeypot and rate limit. |

## Authentication

**Google OAuth only — there are no passwords anywhere, for any role.**

- **Members** are created automatically on first Google sign-in, with the `MEMBER` role and no CMS access.
- **Staff** must be whitelisted first: an admin creates the user row with an email, a role, and status `WHITELISTED`. On that person's first sign-in the email matches, Google's `sub` binds to `providerId`, and the status flips to `ACTIVE`. Staff cannot self-register.
- **The super admin** is upserted at every boot from `SUPER_ADMIN_EMAIL` (`src/lib/ensureSuperAdmin.ts`), so no environment can exist without an administrable account. Its role, `ACTIVE` status, and `isProtected` flag are re-asserted on each start, and a protected account cannot be deleted or demoted by anyone else. If that write fails the process exits rather than serving an unmanageable API.

### Tokens

| | |
|---|---|
| **Access token** | JWT, 15-minute TTL, carries `{sub, role, editorModules}`. Sent as `Authorization: Bearer …`. |
| **Refresh token** | 32 random bytes, sent to the browser in an httpOnly cookie; the database stores only its SHA-256 hash, so a database leak yields no usable credential. |
| **Rotation** | Every refresh revokes the old session and issues a new token. |
| **Reuse detection** | Presenting an already-rotated token revokes *every* live session for that account and writes an `auth.refresh_reuse_detected` audit row — worth alerting on. |
| **Cookie** | httpOnly, `SameSite=Lax`, `Secure` per `COOKIE_SECURE`, scoped to `/api/v1/auth` on `COOKIE_DOMAIN`. |

### Roles

Four hardcoded roles; there is no editable permissions table.

- **SUPER_ADMIN** — everything, and protected from deletion or demotion.
- **ADMIN** — content CRUD and publishing, staff management, audit logs.
- **EDITOR** — content CRUD limited to the modules listed in `editorModules`.
- **MEMBER** — browse published content, like and comment, open gated research PDFs.

Route guards are `requireRole(...)` and `requirePermission(...module)` from `src/plugins/rbac.ts`. Note that EDITOR access is **module-scoped, not record-scoped**: an editor with the `posts` module may edit any post, not only their own.

## API layout

Everything sits under `/api/v1`:

| Namespace | Auth | Purpose |
|---|---|---|
| `/public/*` | none | Published content only. Cacheable, CDN-friendly. |
| `/auth/*` | mixed | Google sign-in, refresh, logout. |
| `/me/*` | member+ | Own profile, likes, comments, SAS-signed research PDFs. |
| `/admin/*` | staff | Full CMS. |

**Response envelope** — success `{ success: true, data, meta? }` (`meta` carries pagination), failure `{ success: false, error: { code, message, details? } }`. Services throw typed `AppError` subclasses; the error-handler plugin turns them into that envelope and never leaks a stack trace in production.

**Rate limits** — 100 requests/minute per IP globally, 30/minute on search, 3/hour on contact and newsletter submissions. Over the limit returns `429` with code `RATE_LIMITED`.

## Data model

`prisma/schema.prisma` is the reference and is commented throughout. The parts worth knowing before reading it:

- **Posts and blogs are one model.** `Post.placement` is `ARTICLE`, `BLOG`, or `BOTH`. Slugs are globally unique, so every post has exactly one canonical URL: `/articles/{slug}`, except `BLOG` placement which lives at `/blogs/{slug}`. A `BOTH` post appears in both listings, and `/blogs/{slug}` is 301-redirected to the article URL — the redirect row is written automatically on create and on slug change.
- **Authors are not users.** A paper's author needs no account; `ResearchAuthor` carries byline order and the corresponding-author flag.
- **Research PDFs live in a private container** and are never given a public URL. Signed-in users get a 60-second SAS URL, and every open is recorded in `ResearchView`.
- **Taxonomy:** `Category` is scoped (ARTICLE/BLOG/RESEARCH), `Tag` is shared between posts and research, `VideoCategory` is independent.
- **SEO columns are inline** on every publicly indexable entity (`metaTitle`, `metaDescription`, `ogImageId`, `noIndex`, …).
- **Search vectors** are `tsvector` columns on `Post` and `Research`, maintained by database triggers, with GIN indexes.
- **Sessions** store hashed refresh tokens, so revocation is real.
- **`AuditLog`** records CMS writes and auth events with actor, IP, entity, and action.

## Seeding

Seeding is never part of `npm run build` — a build produces an artefact and has no database, while seeding acts on one specific database.

**The super admin is not seeded at all.** It is upserted at boot, in every environment, so there is nothing to remember to run.

Everything else is sample content, behind one command:

```bash
npm run seed:content          # idempotent — safe to re-run
npm run seed:content:clean    # removes only what the seeder created
```

`prisma/seed/` holds `data.ts` (the content), `content.ts` (seed and clean logic), and `index.ts` (the CLI). It fills every public endpoint — posts, research with bylines and file metadata, videos, galleries, authors, hero slides, settings, the About page, plus members, comments, likes, contact messages, subscribers, redirects, and audit rows.

Some rows exist specifically to prove the visibility filters work: a draft post, a post dated a week into the future, a draft paper, a draft video, an unpublished gallery segment, a hidden comment, and an inactive hero slide. None of them may appear on a public endpoint or in a sitemap.

Worth knowing:

- Images point at picsum.photos and research PDFs are metadata only — nothing is uploaded to Blob Storage, so the gated download will not resolve a file for seeded papers.
- YouTube ids are real public videos, chosen so thumbnails and embeds load; their titles here are placeholders.
- Re-running overwrites seeded rows from `prisma/seed/data.ts`. Content you authored yourself is never touched — cleanup matches only `seed-` ids, the `seed/` media prefix, and the seeded slugs.
- `clean` leaves site settings and the About page in place; they are configuration, not sample content.
- It refuses to run when `NODE_ENV=production` unless you pass `--force`.

## Search

Postgres-native full-text search, no external engine. Ranking is weighted: title (A), excerpt or abstract (B), body or extracted PDF text (C).

```
GET /api/v1/public/search?q=manuscript&type=post&page=1&limit=20
```

`type` is `post`, `research`, `video`, or `all` (default). Only published content is searchable.

## SEO

Every public detail endpoint returns a resolved `seo` object beside the entity — title, description, canonical URL, robots directive, Open Graph block, and a `jsonLd` array holding a breadcrumb trail plus, where the entity has one, its structured data (`Article` for posts, `ScholarlyArticle` for research, `VideoObject` for videos). Fallbacks are already applied, so the frontend renders what it is given.

Sitemaps: `/sitemap.xml` is an index pointing at `/sitemaps/{type}-{page}.xml`, up to 5,000 URLs per file, cached an hour. Drafts, future-dated items, and `noIndex` entities are excluded. `/api/v1/public/redirects?path=…` backs the frontend's 301 middleware.

## Working on the code

```bash
npm run dev                # hot-reload dev server (tsx watch)
npm run build              # tsc → dist/
npm start                  # run the compiled server

npm run db:generate        # regenerate the Prisma client after schema edits
npm run db:migrate         # create and apply a migration
npm run db:studio          # visual database browser

npm run seed:content       # sample content (idempotent)
npm run seed:content:clean # remove it again

npm run lint               # eslint
npm run format             # prettier
```

Most feature modules under `src/modules/` are four files — `*.schema.ts` (Zod), `*.service.ts` (Prisma and business logic, no HTTP), `*.controller.ts` (thin translation), `*.routes.ts` (registration per namespace). Simpler modules omit what they don't need: `home` is routes only, `search`, `seo`, and `dashboard` are routes plus service. `categories` is the cleanest template to copy. Register new modules in `src/server.ts`.

Request flow is `route → controller → service → Prisma`. Keep HTTP concerns out of services and Prisma out of controllers.

## Deployment

1. Set the environment variables on the platform; the app validates them at boot and exits if any are missing.
2. Apply migrations as an explicit release step, never at boot: `npx prisma migrate deploy`.
3. `npm run build && npm start`.
4. Terminate TLS at Nginx or an ALB in front of port 4000.
5. Scale horizontally as needed — the process is stateless, with sessions in Postgres and files in Azure Blob Storage.

Backups run in-process via `node-cron`: `pg_dump` → gzip → Blob Storage, every three days, 90-day retention, all configurable through `BACKUP_*`. Audit logs are pruned weekly. Both are driven by `src/jobs/`.

Monitoring hooks: `/health` and `/health/ready` for probes, structured JSON logs via pino, and the `AuditLog` table for an action trail.

## Known gaps

Honest list, so nobody plans around something that isn't there:

- **No automated tests.** `vitest` and `supertest` are installed, but no test files exist — `npm test` exits with "No test files found".
- **EDITOR permissions are module-scoped, not record-scoped** — see the Roles section.
- **`src/modules/auth/auth.service.ts` is unused.** The live implementation is `auth.controller.ts`; the service is a parallel copy nothing imports, and should be deleted or adopted rather than left to drift.
- **Related content is not implemented.** Detail endpoints return the entity and its `seo` block only.
- **reCAPTCHA fails open.** If Google is unreachable the submission is allowed through, backed by the honeypot and rate limit; only a token Google actively rejects is refused.

## Documentation

- **`/docs`** — interactive Swagger UI, generated from the route schemas
- **`prisma/schema.prisma`** — the data model, commented
- **`agent.md`** — the original specification and design rationale
- **`IMPLEMENTATION.md`** — build log and reference patterns

## License

Proprietary — Nikunja Seva Pty Ltd & Mahavi Pvt Ltd.
