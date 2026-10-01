# Expense GPT

**Your finances, just chat.**

Expense GPT is a conversational personal finance app. Tell it what happened
("spent 850 on dinner", "Ali paid me 5k", "how much did I spend on food?") and it
records, organizes and reports your money. No forms, no accounting jargon.

> Chat → Record → Understand → Report

- Product definition, scope, data model, AI contract, API and roadmap:
  [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## Stack

| Layer   | Choice                                  |
|---------|-----------------------------------------|
| Mobile  | React Native (Expo) + TypeScript        |
| API     | ASP.NET Core Web API (.NET)             |
| Data    | PostgreSQL                              |
| AI      | LLM used only as a structured extractor |

## First goal

One vertical slice, end to end, before anything else:

`"I spent 850 on dinner"` → API → AI extraction → validation → PostgreSQL →
`✓ Added Rs. 850 · Food · Dinner · Today`

If that feels instant and natural, build the rest around it.
