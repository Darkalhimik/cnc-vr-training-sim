// Applies drizzle/ migrations to DATABASE_URL. Run by `npm run db:migrate`
// locally and by `vercel-build` before each Vercel build; the Docker image
// runs the same migrations on start (src/instrumentation.ts).
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL is not set; skipping.");
  process.exit(0);
}
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log("[migrate] up to date.");
} finally {
  await pool.end();
}
