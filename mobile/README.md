# Expense GPT — mobile

Expo (React Native) client for Expense GPT. It's a second client of the same
Next.js API in [`../web`](../web) — same dashboard, same chat, same Undo —
there is no separate mobile backend.

## Stack

| Layer | Choice |
|-------|--------|
| App | Expo SDK 57 + Expo Router + TypeScript |
| Navigation | Expo Router (`src/app/`) |
| API | Fetches `../web`'s `/api/*` routes directly — no mobile-only backend |

## Run it

1. Start the web API (from the repo root):
   ```bash
   docker compose up -d
   cd web && npm run dev -- -H 0.0.0.0   # -H 0.0.0.0 so a phone/emulator can reach it
   ```
2. In another terminal, set the API URL and start Expo:
   ```bash
   cd mobile
   cp .env.example .env     # edit EXPO_PUBLIC_API_URL — see below
   npm install
   npm start
   ```
3. Open it:
   - **Physical phone:** install the free **Expo Go** app, scan the QR code `npm start` prints. No Android Studio or Xcode needed.
   - **Android emulator:** `npm run android` (requires Android Studio's emulator).
   - **iOS simulator (macOS only):** `npm run ios`.
   - **Browser:** `npm run web`.

### `EXPO_PUBLIC_API_URL`

The app doesn't know where the web server lives — point it there explicitly in `.env`:

| Running on | `EXPO_PUBLIC_API_URL` |
|---|---|
| Physical phone (Expo Go) | `http://<your-computer's-LAN-IP>:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| iOS simulator | `http://localhost:3000` |
| `npm run web` | `http://localhost:3000` |

Restart `expo start` after changing `.env` — `EXPO_PUBLIC_*` vars are inlined at bundle time.

## Checks

```bash
npm run lint && npm run typecheck
```

## Project layout

```
mobile/src/
  app/         _layout.tsx (root Stack) · index.tsx (the Dashboard screen)
  components/  ChatInput · TransactionItem
  lib/         api.ts (fetch client for web/src/app/api/*) · types.ts (API shapes)
               money.ts (formatting, ported from web) · theme.ts (light/dark colors)
```

## Status

Mirrors the web dashboard's Phase 0 slice: balance, this month's income/expenses,
chat box with optimistic sending and Undo, recent transactions. No auth yet —
acts as the same fixed demo user as the web app (`web/src/lib/current-user.ts`).
Monthly report and native builds (EAS) are not set up yet.
