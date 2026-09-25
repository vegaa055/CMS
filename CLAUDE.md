@AGENTS.md

## Project notes

- Placeholder product name "Folio" lives only in `src/config/site.ts`; never hardcode it elsewhere.
- Colors come from CSS tokens in `src/app/globals.css` (dark is the default theme); don't use raw Tailwind palette colors.
- Read env via `@/env`, not `process.env`.
- Next 16: `proxy.ts` replaces `middleware.ts`; request APIs (`params`, `cookies()`, `headers()`) are async.
- Run `npm run typecheck && npm run lint` before committing.
- DB: Drizzle + `drizzle-orm/neon-http` (`@/db`, server-only). No interactive transactions — use `db.batch([...])`.
- Schema changes: edit `src/db/schema/*`, then `npm run db:generate && npm run db:migrate`. Never hand-edit applied migrations.
- Keep `posts.content_text` in sync with `posts.content` via `richTextToPlainText` (feeds the generated `search_vector`).
- Neon project `folio-cms` (snowy-credit-18981856): `main` = prod, `dev` = local.
- Auth: server `@/lib/auth` (Better Auth instance), client `@/lib/auth/client`. Guard admin pages and every server action with `requireSession()` / `requirePermission()`; `proxy.ts` is only an optimistic cookie check.
- Roles/permissions: `src/lib/auth/permissions.ts` (`can`, `canOnResource`). Never trust client-supplied roles.
- Admin UI: nav lives in `src/config/admin-nav.ts` (sidebar, breadcrumbs, ⌘K all read it). Pages use `PageHeader`, `EmptyState`, `DataTable` from `src/components/admin/`. Table column defs must live in client components; pass serializable rows (ISO date strings).
- TanStack Table is pinned to v8 (v9 has a different API).
- Drizzle gotcha: in single-table selects, raw `sql` column refs are unqualified — use joins + groupBy instead of correlated subqueries.
- Session role is cached in a cookie for 5 min (`cookieCache`); role changes need session revocation to apply immediately.
- Editor schema: add/remove Tiptap node or mark extensions only in `src/lib/editor/extensions.ts` (shared by editor, sanitizer, renderer). Editor-only UX extensions (placeholder, typography) go in the editor component.
- Server actions return `ActionResult` (`@/lib/action-result`) and authorize with `getSession()` + permission helpers — never trust ids/roles from the client. Postgres error codes: use `pgError()` from `@/db/errors` (Drizzle wraps driver errors).
- Public visibility: always filter with `livePostWhere()`; display status with `effectiveStatus()`.
- `/admin/posts/[id]` serves both `new` and edit; don't split it (the editor relies on staying mounted across new -> id).
- Tests: `npm test` (pure units) and `npm run test:int` (hits `.env.local` DB; tests clean up their own `int-*` rows).
