// Runs once when the Next.js server starts, before it accepts requests.
// We use it to make sure the database exists and its schema is current, so
// nobody has to remember to run `npm run db:migrate` by hand.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureDatabaseReady } = await import("./db/migrate");
  await ensureDatabaseReady();
}
