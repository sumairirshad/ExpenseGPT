# Expense GPT — Product Spec (v1.0 draft)

> Expense GPT is a conversational personal finance app where users tell the app
> what they spent or earned, and it records, organizes and reports their finances.

**Feel:** simple, fast, conversational, accurate, private.
**Benchmark:** a user can open the app and record an expense in under 5 seconds.
**Not:** accounting software. Think "ChatGPT for your personal finances".

---

## 1. Principles

1. **Chat is the primary interface.** Recording a transaction never needs more than one screen and one input.
2. **The AI understands; the backend decides.** The model turns text into a structured request. It never calculates, never reads the database, never writes numbers into replies.
3. **Every number the user sees comes from SQL.** Replies are rendered by backend templates from query results (see §5.4). This makes hallucinated figures structurally impossible.
4. **Ask rather than guess.** Missing or ambiguous amount, type or target → one short clarifying question.
5. **Always reversible.** Every write has an Undo; edits and deletes are confirmed in the reply.
6. **Minimal data to the AI provider.** Send only what is needed to interpret one message.

---

## 2. Scope

### V1 (MVP)
- Auth: register, login, logout (email/password; Google login right after first prototype).
- Dashboard: balance, income, expenses, chat box, recent transactions, report shortcut.
- Chat intents: add expense, add income, ask balance, ask monthly spending, ask category spending, edit last/matching transaction, delete transaction.
- Transactions: list, edit, delete.
- Monthly report: income vs expenses, net, category breakdown, chart, **shareable** (image/PDF via system share sheet).
- Single default currency per user (PKR default). No conversion.

### Later (V2+)
Debts/credits ledger, recurring transactions, voice input, receipt OCR, budgets, spending insights, CSV/Excel/PDF export, multi-currency, web dashboard, custom categories.

### Explicitly not building
Bank sync, investments, crypto, tax, credit cards, complex accounting, financial advice, business/multi-user accounting, advanced AI agents.

> **Change vs. original brief:** credit/owed/debt (`Ali owes me 5000`, `I owe Ahmed 3000`) moves out of V1. It needs its own ledger and settlement logic, and the brief itself says to keep it separate. In V1 the assistant recognizes these phrases and replies "Debt tracking is coming soon" instead of mis-recording them as income/expense.

---

## 3. Core experience

### 3.1 Dashboard

```
┌──────────────────────────────────────┐
│ Expense GPT                      👤  │
│ October 2026                         │
│                                      │
│ Balance            Rs. 75,650        │
│ Income Rs. 150,000  Expenses Rs. 74,350
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ I spent 850 on dinner...      ➤  │ │
│ └──────────────────────────────────┘ │
│ Try: "Spent 500 on lunch"            │
│      "Received 50,000 salary"        │
│      "How much did I spend this month?"
│                                      │
│ Recent transactions (latest 8)       │
│ Dinner                      -850     │
│ Uber                        -450     │
│ Salary                  +150,000     │
│                                      │
│        View Monthly Report           │
└──────────────────────────────────────┘
```

Behavior details that make it feel fast:
- Input is focused on open; send on Enter/➤.
- **Optimistic UI:** the user's message and a typing indicator appear instantly; balance/recent list update the moment the API confirms.
- Replies appear as a short chat bubble above the input (last 1–3 messages), not a full chat screen. Full history lives behind a "Chat history" link.
- Suggestion chips tap-to-fill the input; they rotate based on what the user has not tried yet.
- Empty state (new user): a single prompt, "Tell me about your first expense or income."

### 3.2 Definitions (to avoid ambiguity)
- **Balance** = all-time income − all-time expenses *(V1; opening balance can be recorded as income "Opening balance")*.
- **Income / Expenses on dashboard** = current calendar month in the user's timezone.
- **Net (report)** = income − expenses for that month.
- Month boundaries use the user's timezone, never server time.

### 3.3 Confirmations

```
✓ Added Rs. 850 expense
Food · Dinner · Today              [Undo]
```

Clarifications:
```
You: Bought something for 500
App: What did you spend the Rs. 500 on?

You: I bought groceries
App: How much did you spend on groceries?
```

Editing is conversational and always targets something explicit:
```
You: Actually it was 750          → edits the last transaction created in this session
App: ✓ Updated Lunch: Rs. 500 → Rs. 750

You: Remove the lunch expense     → multiple matches
App: Which lunch expense?
     1. Today — Rs. 750
     2. Yesterday — Rs. 600
```
Delete always shows what was removed, with [Undo] for 30 seconds.

---

## 4. Natural-language understanding

### 4.1 Inputs it must handle
- Free word order: `850 dinner`, `Spent 850 on dinner`, `Dinner cost me 850`.
- Shorthand amounts: `5k`, `1.5k`, `2 lakh`, `1.2m`, `50,000`, `50000`.
- Dates: `today`, `yesterday`, `last Friday`, `on the 3rd`, `Oct 1`.
- Mixed language / Roman Urdu: `850 ka dinner`, `kal 500 ki chai`. *(Worth testing early; the first target market is Pakistan.)*
- Typos and filler: `i spnt 850 on dinnr lol`.

### 4.2 Transaction types in V1
| Type | Examples |
|------|----------|
| `expense` | Spent 500 on lunch · Paid 3000 electricity bill |
| `income`  | Received 50,000 salary · Client paid me 100,000 |

> **Ambiguity rule:** `Ali paid me 5000` is a person-to-person repayment, not income. In V1 the app asks: *"Record this as income, or is Ali repaying you?"* and stores the person in `person`. When the debt ledger ships this becomes a first-class `credit` entry.

### 4.3 Categories
Food, Groceries, Transport, Shopping, Bills, Rent, Utilities, Entertainment, Health, Education, Travel, Subscriptions, Personal, Business, Other.
Income categories: Salary, Freelance, Business, Gift, Other.
- AI proposes one category; backend validates against the user's category list; unknown → `Other`.
- Lightweight learning: if a user re-categorizes "Uber" → Transport twice, remember `merchant → category` per user and apply it before calling the AI.
- Custom categories: later.

---

## 5. AI architecture

```
Message ─► Pre-processor ─► LLM extraction ─► Schema validation
                                                    │
                                          Business rules (dates, amounts,
                                          category, ambiguity, permissions)
                                                    │
                                   ┌────────────────┴────────────────┐
                                 write                              read
                           (PostgreSQL txn)               (SQL aggregate queries)
                                   └────────────────┬────────────────┘
                                                    ▼
                                      Template-rendered reply
```

### 5.1 What is sent to the LLM
Only: the user's message, today's date and timezone, the category list, and (for edit/delete) the last 3 transactions' short descriptors. **Never** balances, history or personal identifiers. Provider is configured to not retain/train on data.

### 5.2 Extraction contract
The LLM is forced to return JSON matching this schema (tool/function call or structured output). Anything else is rejected and retried once, then falls back to a clarification.

```json
{
  "intent": "CREATE_EXPENSE",
  "confidence": 0.93,
  "transaction": {
    "amount": 850,
    "category": "food",
    "description": "Dinner",
    "merchant": null,
    "person": null,
    "date_expression": "yesterday"
  },
  "query": null,
  "missing": [],
  "clarification": null
}
```
- The model returns `date_expression` (`"yesterday"`, `"2026-09-30"`). **The backend resolves dates** with the user's timezone — the model is never trusted to do date math.
- Amounts are parsed to a number by the model *and* cross-checked against a regex on the original text; mismatch → ask the user.
- Query intents carry `period` (`current_month`, `last_month`, `{year, month}`, `all_time`), optional `category`, optional `compare_to`.

### 5.3 Intents
**Write:** `CREATE_EXPENSE`, `CREATE_INCOME`, `UPDATE_TRANSACTION`, `DELETE_TRANSACTION`
**Read:** `GET_BALANCE`, `GET_MONTHLY_TOTAL`, `GET_CATEGORY_TOTAL`, `GET_TRANSACTION_HISTORY`, `GET_MONTHLY_REPORT`, `GET_BIGGEST_EXPENSE`, `COMPARE_PERIODS`
**Control:** `CLARIFY` (needs more info), `UNSUPPORTED` (debt/credit/advice in V1), `SMALLTALK` (greeting/help)
**Reserved (V2):** `CREATE_CREDIT`, `CREATE_DEBT`

### 5.4 Responses are templates, not generated text
The backend runs the query, then fills a template:

```
GET_MONTHLY_TOTAL → "You've spent {total} this month." + top categories list
```
Numbers, dates and names come from the database. The LLM may only *choose* which template/intent applies. Benefits: zero hallucinated figures, lower cost (one LLM call per message), predictable tone, easy localization. An optional "friendly phrasing" pass can be added later for non-numeric sentences only.

### 5.5 Safety & robustness
- Validation: amount > 0 and ≤ configured max; date not more than 1 year in the past or 7 days in the future (else confirm); description ≤ 200 chars.
- Low confidence (< 0.7) or any validation warning → confirm before saving: "Add Rs. 5,000 expense for Rent?  [Yes] [Edit]".
- Prompt-injection safe by design: model output can only select from a fixed intent set; it has no tools that touch the database directly. The backend scopes every query by `userId` from the auth token, never from model output.
- Idempotency key per chat request, so retries/double taps never double-record.
- Fallback when the LLM is down: a deterministic regex parser handles the common `"<amount> <text>"` / `"spent <amount> on <text>"` patterns; everything else says "I'm having trouble understanding right now — try again."
- Rate limits per user; free-tier quota enforced server-side.

---

## 6. Data model (PostgreSQL)

**Money is stored as integer minor units** (or `NUMERIC(14,2)`), never floating point.

```
users               id, name, email, password_hash, google_sub, default_currency,
                    timezone, created_at, deleted_at
categories          id, user_id (null = system default), name, type (expense|income), created_at
transactions        id, user_id, type, amount_minor, currency, category_id,
                    description, merchant, person, transaction_date (date),
                    created_at, updated_at, deleted_at, source (chat|manual),
                    chat_message_id
chat_messages       id, user_id, role (user|assistant), message, intent,
                    request_id (idempotency), created_at
merchant_rules      id, user_id, merchant, category_id        -- per-user learning
user_settings       user_id, default_currency, locale, share_defaults
recurring_transactions   (V2)
debts               (V2)
```
- Soft delete (`deleted_at`) on transactions powers Undo; hard purge after 30 days.
- Indexes: `(user_id, transaction_date desc)`, `(user_id, category_id, transaction_date)`.
- Every query includes `user_id`; consider Postgres row-level security as defence in depth.

Transaction JSON (API shape):
```json
{
  "id": "uuid", "type": "expense", "amount": 850, "currency": "PKR",
  "category": "food", "description": "Dinner", "merchant": null, "person": null,
  "date": "2026-10-01", "createdAt": "2026-10-01T16:30:00Z", "source": "chat"
}
```

---

## 7. API

All endpoints require a bearer token except `/api/auth/*`. Errors use RFC 7807 problem details.

| Area | Endpoint | Purpose |
|------|----------|---------|
| Auth | `POST /api/auth/register` `/login` `/google` `/refresh` `/logout` | Sessions (short-lived access + refresh token) |
| Chat | `POST /api/chat` | `{ "message", "requestId" }` → reply |
| Chat | `GET /api/chat/history` | Paged history |
| Transactions | `GET /api/transactions?from=&to=&category=&type=&cursor=` | List |
| | `POST /api/transactions` | Manual create |
| | `PUT /api/transactions/{id}` | Update |
| | `DELETE /api/transactions/{id}` | Soft delete |
| | `POST /api/transactions/{id}/restore` | Undo |
| Categories | `GET /api/categories` | List |
| Reports | `GET /api/reports/monthly?year=2026&month=10` | Report data |
| Reports | `GET /api/reports/monthly/share?year=&month=` | Share image/PDF |
| Dashboard | `GET /api/dashboard` | Balance, month totals, 8 recent — one round trip |
| Users | `GET/PUT /api/users/me` · `DELETE /api/users/me` | Profile, settings, account deletion |

Chat response:
```json
{
  "intent": "CREATE_EXPENSE",
  "status": "saved",               // saved | needs_clarification | needs_confirmation | answered | error
  "message": "✓ Added Rs. 850 expense\nFood · Dinner · Today",
  "transaction": { "id": "uuid", "amount": 850, "category": "food" },
  "undoToken": "…",
  "suggestions": ["Show my monthly report"]
}
```

---

## 8. Reports
- **Monthly report:** income, expenses, net, category breakdown (amount + % of spend), income-vs-expense bar, donut or bar chart for categories, top 3 expenses.
- Chat access: `Show my October report` renders the same report inline and links to the full screen.
- **Sharing (V1):** render the report as an image (and PDF later) and open the native share sheet. Share-safe by default: hides transaction descriptions, shows only totals and categories.
- Natural-language questions supported in V1: balance, monthly spend, category spend, biggest expense, income this month, compare two months. Each maps to a fixed, tested SQL query.

---

## 9. Stack and clients

One language end to end: **TypeScript**.

| Layer | Choice |
|-------|--------|
| Web app + API | Next.js (App Router) — route handlers serve `/api/*` |
| Database | PostgreSQL via Drizzle ORM (SQL migrations in `web/drizzle/`) |
| AI | Anthropic TypeScript SDK, structured outputs; rule-based parser as fallback |
| Validation | Zod (request bodies and the AI extraction contract) |
| Tests | Vitest |
| Mobile (later) | Expo React Native calling the same API, sharing types |

**Web first.** The Next.js app is the first client: mobile-first layout, installable to the home screen, so real users can test before app-store work. The Expo app follows once the chat flow is proven.

```
web/src/
  app/         page.tsx (Dashboard) · api/chat · api/dashboard · api/transactions/[id]
  components/  Dashboard · ChatInput · TransactionItem
  lib/ai/      schema.ts (extraction contract) · claude.ts · rules.ts · extract.ts
  lib/chat/    service.ts (validate → act → template reply) · drizzle-store.ts
  lib/         money.ts · dates.ts · categories.ts · dashboard.ts
  db/          schema.ts · index.ts
```
- Dashboard is the home screen and the only place needed to record anything.
- Mobile (later): TanStack Query for server state; secure token storage (Keychain/Keystore).
- Money formatting via `Intl.NumberFormat` with the user's currency; never do math on formatted strings.
- Offline: queue the message and show "will send when you're back online" (V1.1).

---

## 10. Privacy & security
- TLS everywhere; passwords hashed with Argon2id/bcrypt; encryption at rest for the database and backups; sensitive free-text fields (description, person) optionally column-encrypted.
- Strict per-user authorization on every endpoint; automated tests that user A cannot read or write user B's data.
- AI provider: zero-retention setting, no training on user data, minimal payload (§5.1). In-app plain-language "How your data is used" page.
- Account and data deletion in Settings (hard delete within 30 days; confirmed by email).
- Logs never contain message text or amounts.
- Analytics are event-level and anonymous (no message content).

---

## 11. Monetization (to be tested, not assumed)
| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | 100 transactions/month, basic reports, basic chat |
| Pro | $4.99/mo | Unlimited, advanced reports, recurring, voice, export, insights |
| Premium | $9.99/mo | Receipt scanning, advanced AI, multi-currency, cloud backup, priority processing |

Quota is enforced server-side; the app shows usage ("62 / 100 this month"), never silently drops a message.

---

## 12. Quality: how we know it works

**Extraction eval set** — a versioned file of ~200 real-style messages with expected JSON (all phrasings in §4.1, typos, Roman Urdu, edge cases, adversarial/injection strings). Run on every prompt/model change; track accuracy per field.

Targets for V1 launch:
| Metric | Target |
|--------|--------|
| Amount extracted correctly | ≥ 99% |
| Type (expense/income) correct | ≥ 98% |
| Category matches user intent | ≥ 90% |
| Date resolved correctly | ≥ 97% |
| Clarification asked when truly ambiguous | ≥ 90% |
| p50 end-to-end latency (message → confirmation) | < 1.5 s |
| p95 latency | < 3 s |

Also: unit tests for date/amount parsing and report SQL, integration tests against a real Postgres, cross-user isolation tests.

---

## 13. Roadmap

**Phase 0 — Vertical slice (first goal)**
Next.js dashboard with one input → `POST /api/chat` → LLM extraction → validation → PostgreSQL → `✓ Added Rs. 850 expense · Food · Dinner · Today`. Fixed demo user, no auth. Build the eval set alongside. *Exit criterion: it feels instant and natural.* **Status:** slice built in `web/`; the ~200-message eval set is still to do.

**Phase 1 — Foundation:** auth, user/timezone/currency, migrations, CI.
**Phase 2 — Transactions:** list, edit, delete, undo, categories.
**Phase 3 — Chat:** all V1 intents, clarification flow, conversational edit/delete, query intents, deterministic fallback.
**Phase 4 — Dashboard:** balance/income/expenses, recent, suggestions, optimistic UI.
**Phase 5 — Reports:** monthly report, charts, share.
**Phase 6 — Beta:** error handling, security review, privacy policy, terms, crash monitoring, analytics, user testing.
**Phase 7 — Launch:** web launch, then the Expo app on Play Store / App Store, landing page, free plan, Pro subscription, feedback loop.

---

## 14. Open questions
1. Opening balance: separate field, or a first "income" entry? (Spec assumes the latter.)
2. Should the backend or the client format replies for localization (English / Urdu)?
3. Which LLM provider/model for extraction — choose after running the eval set on two or three candidates (cost and latency matter more than raw capability for this task).
4. Share format for reports: image only, or PDF at launch?
5. Do we need Google login before beta, or can email/password ship first?
