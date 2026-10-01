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
| AI            | Claude via the Anthropic SDK, used only as an extractor   |
| Mobile        | Expo React Native + TypeScript, calling the same API      |

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
cp .env.example .env.local           # add ANTHROPIC_API_KEY to use Claude (optional)
npm install
npm run db:migrate
npm run dev                          # http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, messages are parsed by the built-in rule-based
extractor, which covers the common phrasings. With a key, Claude interprets the
message (typos, unusual wording) and the same backend rules validate the result.

## Run the mobile app

```bash
cd mobile
cp .env.example .env                 # point EXPO_PUBLIC_API_URL at the web server above
npm install
npm start                            # scan the QR code with Expo Go — no Android Studio/Xcode needed
```

See [`mobile/README.md`](mobile/README.md) for emulator/simulator URLs and details.

## Checks

```bash
cd web
npm run lint && npm run typecheck && npm test && npm run build

cd ../mobile
npm run lint && npm run typecheck
```
