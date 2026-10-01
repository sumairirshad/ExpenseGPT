import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Resolved from the process cwd (the `web/` package root when run via `next`
// or any `npm run` script), matching drizzle.config.ts's `out`.
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

// Postgres always ships a "postgres" maintenance database; connect there to
// check for / create the app's own database, since you can't CREATE DATABASE
// while connected to the database you're creating.
const MAINTENANCE_DATABASE = "postgres";

const VALID_DATABASE_NAME = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Makes sure the app's database exists and its schema is current, before the
 * server starts handling requests. Safe to call on every boot: creating the
 * database is a no-op when it already exists, and drizzle's migrator only
 * (re)applies migrations it hasn't recorded as run yet, so a fresh database
 * gets every table, and an existing one only gets what's missing.
 *
 * If Postgres itself isn't reachable (e.g. `docker compose up -d` hasn't
 * been run yet), this logs a hint and returns rather than crashing the
 * server — the dashboard already reports a clear per-request error in that
 * case, and the server should still start so a developer can fix it without
 * restarting.
 */
export async function ensureDatabaseReady(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL is not set; skipping automatic database setup. Copy .env.example to .env.local.");
    return;
  }

  let target: URL;
  let databaseName: string;
  try {
    target = new URL(url);
    databaseName = decodeURIComponent(target.pathname.replace(/^\//, ""));
  } catch {
    console.error("DATABASE_URL is not a valid connection string; skipping automatic database setup.");
    return;
  }
  if (!databaseName) {
    console.error("DATABASE_URL has no database name; skipping automatic database setup.");
    return;
  }

  const created = await createDatabaseIfMissing(target, databaseName);
  if (created === "unreachable") return;

  await runMigrations(url);
}

async function createDatabaseIfMissing(target: URL, databaseName: string): Promise<"ok" | "unreachable"> {
  const maintenanceUrl = new URL(target);
  maintenanceUrl.pathname = `/${MAINTENANCE_DATABASE}`;
  const sql = postgres(maintenanceUrl.toString(), { max: 1, onnotice: () => {} });

  try {
    const rows = await sql`select 1 from pg_database where datname = ${databaseName}`;
    if (rows.length === 0) {
      if (!VALID_DATABASE_NAME.test(databaseName)) {
        throw new Error(`Refusing to auto-create database with an unusual name: "${databaseName}"`);
      }
      // Identifiers can't be parameterized; validated above.
      await sql.unsafe(`CREATE DATABASE "${databaseName}"`);
      console.log(`Expense GPT: created database "${databaseName}".`);
    }
    return "ok";
  } catch (err) {
    if (isConnectionError(err)) {
      warnUnreachable(`check/create the "${databaseName}" database`, err);
      return "unreachable";
    }
    throw err;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Expense GPT: database schema is up to date.");
  } catch (err) {
    if (isConnectionError(err)) {
      warnUnreachable("run migrations", err);
      return;
    }
    throw err;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function isConnectionError(err: unknown): boolean {
  const code = (err as { code?: string } | undefined)?.code;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT";
}

function warnUnreachable(action: string, err: unknown): void {
  const reason = err instanceof Error ? err.message : String(err);
  console.warn(
    `Expense GPT: couldn't reach Postgres to ${action} (${reason}). ` +
      `Start it with "docker compose up -d", then restart the app.`,
  );
}
