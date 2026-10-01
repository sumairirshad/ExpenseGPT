import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // Reuse the pool across hot reloads in development.
  var __expenseGptSql: ReturnType<typeof postgres> | undefined;
}

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}

export function getDb() {
  globalThis.__expenseGptSql ??= postgres(connectionString(), { max: 10 });
  return drizzle(globalThis.__expenseGptSql, { schema });
}

export type Db = ReturnType<typeof getDb>;
