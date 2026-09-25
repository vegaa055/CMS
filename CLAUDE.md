@AGENTS.md

## Project notes

- Placeholder product name "Folio" lives only in `src/config/site.ts`; never hardcode it elsewhere.
- Colors come from CSS tokens in `src/app/globals.css` (dark is the default theme); don't use raw Tailwind palette colors.
- Read env via `@/env`, not `process.env`.
- Next 16: `proxy.ts` replaces `middleware.ts`; request APIs (`params`, `cookies()`, `headers()`) are async.
- Run `npm run typecheck && npm run lint` before committing.
