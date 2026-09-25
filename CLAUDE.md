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
