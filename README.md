# Expense GPT

**Your finances, just chat.**

Expense GPT is a conversational personal finance app. Tell it what happened
("spent 850 on dinner", "got 50k salary", "how much did I spend on food?") and it
records, organizes and reports your money. No forms, no accounting jargon.

> Chat → Record → Understand → Report

- Product definition, scope, data model, AI contract, API and roadmap:
  [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## Stack

| Layer         | Choice                                                    |
|---------------|-----------------------------------------------------------|
| Web app + API | Next.js (App Router) + TypeScript                         |
| Database      | PostgreSQL + Drizzle ORM                                  |
| AI            | Claude or OpenAI, used only as an extractor               |
| Mobile        | Expo React Native, later, against the same API            |

## Status: Phase 0 (vertical slice)

`"I spent 850 on dinner"` → `POST /api/chat` → extraction → validation →
PostgreSQL → `✓ Added Rs. 850 expense · Food · Dinner · Today`

What works today:

- Dashboard: balance, this month's income and expenses, chat box, recent transactions, Undo.
- Record expenses and income in free-form English or Roman Urdu (`850 ka dinner`, `kal 500 ki chai`),
  with shorthand amounts (`5k`, `2 lakh`) and dates (`yesterday`, `last friday`, `oct 3`).
- Clarifying questions for missing amounts, vague purchases, and "Ali paid me 5000".
- Questions answered from SQL: balance, monthly spending (with category breakdown), category spending.
- One fixed demo user (no auth yet).

## Run it locally

```bash
docker compose up -d                 # Postgres on :5432 (or use your own)
cd web
cp .env.example .env.local           # add ANTHROPIC_API_KEY and/or OPENAI_API_KEY (optional)
npm install
npm run dev                          # http://localhost:3000
```

No separate migration step: on startup the app itself creates the
`expensegpt` database if it doesn't exist yet on the Postgres server
`DATABASE_URL` points to, then applies any migration under `drizzle/` it
hasn't run yet — a fresh database gets every table, and an existing one
only gets whatever's missing (a new column, a new table). This runs once
when the Next.js server boots (`src/instrumentation.ts` →
`src/db/migrate.ts`), before it accepts requests. If Postgres itself isn't
running yet, it logs a hint to run `docker compose up -d` and starts
anyway, instead of crashing. `npm run db:migrate` still works directly
(e.g. in CI, or to apply migrations without starting the app).

Without `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, messages are parsed by the
built-in rule-based extractor, which covers the common phrasings. With a key,
Claude or OpenAI interprets the message (typos, unusual wording) and the same
backend rules validate the result. Claude is tried first when both keys are
set; set `AI_PROVIDER=openai` to prefer OpenAI instead. If the preferred
provider's call fails, the other configured provider is tried before falling
back to the rule-based parser.

## Checks

```bash
cd web
npm run lint && npm run typecheck && npm test && npm run build
```
