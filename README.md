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
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script              | Purpose                             |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the dev server (Turbopack)    |
| `npm run build`     | Production build                    |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | Generate route types and run `tsc`  |
| `npm run format`    | Prettier (with Tailwind class sort) |

## Roadmap

- [x] **Phase 0** — Scaffold, design tokens, dark/light theme
- [x] **Phase 1** — Neon + Drizzle schema, migrations, seed
- [x] **Phase 2** — Auth (Better Auth) and roles
- [ ] **Phase 3** — Admin dashboard shell
- [ ] **Phase 4** — Posts: editor, drafts, publishing, tags
- [ ] **Phase 5** — Media library on R2
- [ ] **Phase 6** — Public site, search, SEO, RSS
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

## Database

Postgres on Neon, accessed with Drizzle over Neon's HTTP driver. Schema lives in `src/db/schema/`.

| Script                | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `npm run db:generate` | Generate a SQL migration from schema changes     |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`       |
| `npm run db:seed`     | Seed demo settings, tags, and posts (idempotent) |
| `npm run db:studio`   | Open Drizzle Studio                              |

Neon branches: `main` (production) and `dev` (local development — use its URL in `.env.local`).
