# Expense GPT — web app + API

Next.js app that serves both the dashboard and the `/api/*` routes.
Setup, scripts and the product spec are in the [root README](../README.md).

- `src/lib/ai/` — extraction contract (`schema.ts`), Claude extractor, rule-based fallback
- `src/lib/chat/service.ts` — validates an extraction, saves or queries, and renders the reply from templates
- `src/db/` — Drizzle schema; migrations live in `drizzle/`
