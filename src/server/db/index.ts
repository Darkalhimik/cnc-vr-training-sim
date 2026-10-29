import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * One pool per server process. Plain `pg` over TCP serves both deployments:
 * the Postgres container on a self-hosted box, and Neon behind Vercel through
 * its pooled connection string (`…-pooler…/db?sslmode=require`), where a
 * function instance keeps a connection or two between requests.
 *
 * Kept on globalThis so dev-server reloads reuse it instead of leaking pools.
 */
type Db = NodePgDatabase<typeof schema>;

const cache = globalThis as unknown as { __cncDb?: { pool: Pool; db: Db } };

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 5),
    // Neon suspends after 5 idle minutes; drop our side of the socket first.
    idleTimeoutMillis: 60_000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export function getDb(): Db {
  cache.__cncDb ??= connect();
  return cache.__cncDb.db;
}

export { schema };
