/**
 * Runs once when the server starts. The self-hosted image migrates its
 * database here (MIGRATE_ON_START=1 in docker-compose.yml), so updating the
 * box is pull, build, up. Vercel migrates during its build instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.MIGRATE_ON_START === "1") {
    const { runMigrations } = await import("./server/db/migrate");
    await runMigrations();
  }
}
