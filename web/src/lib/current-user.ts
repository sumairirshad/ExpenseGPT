import { getDb } from "@/db";
import { users } from "@/db/schema";

// Phase 0 has no authentication: every request acts as one demo user.
// This is the single place to swap for a real session lookup in Phase 1.
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

let ensured: Promise<void> | null = null;

export async function currentUserId(): Promise<string> {
  ensured ??= getDb()
    .insert(users)
    .values({ id: DEMO_USER_ID, name: "Demo", email: "demo@expensegpt.local" })
    .onConflictDoNothing()
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      throw err;
    });
  await ensured;
  return DEMO_USER_ID;
}
