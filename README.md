# Folio

A modern, general-purpose CMS built with Next.js, Postgres, and a dark-first design system.

> **Folio** is a placeholder name. Change it in [`src/config/site.ts`](src/config/site.ts).

## Stack

| Layer         | Choice                                             |
| ------------- | -------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Server Actions)            |
| Language      | TypeScript                                         |
| Styling / UI  | Tailwind CSS v4 + shadcn/ui (Radix)                |
| Theming       | next-themes, OKLCH tokens in `src/app/globals.css` |
| Database      | Neon Postgres                                      |
| ORM           | Drizzle                                            |
| Auth          | Better Auth                                        |
| Media storage | Cloudflare R2 (S3-compatible)                      |
| Editor        | Tiptap                                             |
| Hosting       | Vercel                                             |

## Getting started

```bash
npm install
cp -n .env.example .env.local   # -n: never overwrites an existing .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script              | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the dev server (Turbopack)          |
| `npm run build`     | Production build                          |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | Generate route types and run `tsc`        |
| `npm run format`    | Prettier (with Tailwind class sort)       |
| `npm test`          | Unit tests (Vitest)                       |
| `npm run test:int`  | Integration tests against `.env.local` DB |

## Roadmap

- [x] **Phase 0** — Scaffold, design tokens, dark/light theme
- [x] **Phase 1** — Neon + Drizzle schema, migrations, seed
- [x] **Phase 2** — Auth (Better Auth) and roles
- [x] **Phase 3** — Admin dashboard shell
- [x] **Phase 4** — Posts: editor, drafts, publishing, tags
- [x] **Phase 5** — Media library on R2
- [x] **Phase 6** — Public site, search, SEO, RSS
- [ ] **Phase 7** — User management and site settings
- [ ] **Phase 8** — Tests, CI, Vercel deploy

The previous PHP version of this project is preserved at the `legacy-php` git tag.

## Authentication

Better Auth (email/password, optional GitHub OAuth) with three roles: **admin**, **editor**, **author**.

- The **first account** to register becomes the admin. After that, registration is closed
  unless `AUTH_ALLOW_SIGNUP=true`.
- `/admin` is gated optimistically in `src/proxy.ts`; every page and server action
  re-checks with `requireSession()` / `requirePermission()` from `src/lib/auth/session.ts`.
- Permissions live in `src/lib/auth/permissions.ts`.

## Content

- Posts are written in a Tiptap editor and stored as ProseMirror JSON (`posts.content`), validated
  against the editor schema and link-sanitized on save. They are rendered server-side with the same
  extensions (`src/lib/editor/extensions.ts`), so no editor JS ships to readers.
- Drafts autosave; published posts change only on an explicit **Update**.
- Statuses: `draft` → `scheduled` / `published` → `archived`. A scheduled post goes live when its
  publish time passes, without a cron job (see `livePostWhere` / `effectiveStatus`).
- Authors write drafts; editors and admins publish. Drafts can be previewed at `/preview/posts/<id>`.

## Public site

| Route                         | What                                                    | Rendering            |
| ----------------------------- | ------------------------------------------------------- | -------------------- |
| `/`                           | Featured post, recent writing, topics                   | Static, ISR 5 min    |
| `/posts`, `/posts/[slug]`     | Archive (paginated) and post pages (prev/next, related) | Post pages SSG + ISR |
| `/tags`, `/tags/[slug]`       | Topics and per-topic archives                           | ISR / dynamic        |
| `/search?q=`                  | Postgres full-text search with highlighted snippets     | Dynamic              |
| `/feed.xml`                   | RSS 2.0 with full content                               | Static, ISR 5 min    |
| `/sitemap.xml`, `/robots.txt` | Generated from live content                             | Static               |

Every post gets generated Open Graph image (`opengraph-image.tsx`, fonts in `assets/fonts`),
canonical URLs, article metadata, and schema.org `BlogPosting` JSON-LD.

**Caching:** public pages are statically generated and refreshed two ways — immediately when
content changes (`revalidatePublicSite()` from the admin actions) and every 5 minutes, which is
also how scheduled posts go live without a cron job.

## Media storage

Uploads go **directly from the browser to storage** using short-lived signed URLs; the server
then verifies the stored object (exists, size, type) before recording it. Two drivers share one
interface (`src/lib/storage`):

| `STORAGE_DRIVER` | Where files live                     | Use for                 |
| ---------------- | ------------------------------------ | ----------------------- |
| `local`          | `./.uploads`, served at `/uploads/…` | Local development       |
| `r2`             | Cloudflare R2 bucket (public URL)    | Previews and production |

Accepted: JPEG, PNG, WebP, GIF, AVIF up to 10 MB (SVG is intentionally excluded).

### Setting up Cloudflare R2

1. **Create a bucket** — Cloudflare dashboard → R2 → _Create bucket_ (e.g. `folio-media`).
2. **Public access** — bucket → _Settings_ → _Public access_: enable the `r2.dev` subdomain
   (fine for testing) or connect a custom domain (recommended for production). Copy that URL.
3. **CORS** — bucket → _Settings_ → _CORS policy_ (add your production origin later):
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. **API token** — R2 → _Manage API tokens_ → _Create API token_ with **Object Read & Write**,
   scoped to the bucket. Copy the Access Key ID and Secret Access Key. Your Account ID is on the
   R2 overview page.
5. **Configure** `.env.local`, then restart the dev server:
   ```bash
   STORAGE_DRIVER=r2
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=folio-media
   R2_PUBLIC_URL=https://pub-xxxx.r2.dev
   ```

Files uploaded with the local driver aren't copied to R2 when you switch.

## Database

Postgres on Neon, accessed with Drizzle over Neon's HTTP driver. Schema lives in `src/db/schema/`.

| Script                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `npm run db:generate` | Generate a SQL migration from schema changes     |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`       |
| `npm run db:seed`     | Seed demo settings, tags, and posts (idempotent) |
| `npm run db:studio`   | Open Drizzle Studio                              |

Neon branches: `main` (production) and `dev` (local development — use its URL in `.env.local`).
