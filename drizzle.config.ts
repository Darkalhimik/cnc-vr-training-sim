import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes SQL migrations from the schema; it needs no
// database. scripts/migrate.mjs applies them.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
