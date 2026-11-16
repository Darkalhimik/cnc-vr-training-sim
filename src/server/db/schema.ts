/**
 * The database: Better Auth's four tables, then the trainee's progress, the
 * parts in their warehouse and the tools they load into each machine.
 *
 * One schema for every deployment — Postgres in Docker on a self-hosted box,
 * Neon behind Vercel. Migrations are generated from this file into drizzle/
 * by `npm run db:generate` and applied by scripts/migrate.mjs.
 *
 * Sizes are budgeted for Neon's free plan (0.5 GB per project, of which we
 * plan to use half): a saved part is its compressed distance field, not a
 * mesh — see src/features/warehouse/part-field.ts.
 */
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const created = () => timestamp("createdAt").notNull().defaultNow();
const updated = () =>
  timestamp("updatedAt")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------- Better Auth
// Field names are Better Auth's own (camelCase columns), so its Drizzle
// adapter maps them one to one.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  /** Set by the anonymous plugin: a guest who has not signed up yet. */
  isAnonymous: boolean("isAnonymous").default(false),
  createdAt: created(),
  updatedAt: updated(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: created(),
  updatedAt: updated(),
});

// ---------------------------------------------------------------- the app

/**
 * The best a trainee has done on a level. One row per user and level; a
 * level id is unique across machines (`umc500.tutorial.startup`).
 */
export const levelProgress = pgTable(
  "level_progress",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    machineId: text("machineId").notNull(),
    levelId: text("levelId").notNull(),
    /** First completion; null while only attempted. */
    completedAt: timestamp("completedAt"),
    bestSeconds: integer("bestSeconds"),
    /** 0–100, tasks only. */
    bestScore: integer("bestScore"),
    /** 0–3. */
    stars: integer("stars").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: updated(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.levelId] }), index("progress_machine_idx").on(t.userId, t.machineId)],
);

/**
 * Every attempt at a level, one row each — finished or given up — with its
 * time and score; level_progress keeps the best of them. A task's score is
 * worked out on the server from the measured volumes kept here. The action
 * log is the attempt itself: its starting machine and every input the
 * machine's reducer was given, gzipped JSON (entities/machine/action-log.ts),
 * enough to play the attempt again exactly.
 */
export const levelAttempt = pgTable(
  "level_attempt",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    machineId: text("machineId").notNull(),
    levelId: text("levelId").notNull(),
    startedAt: timestamp("startedAt").notNull(),
    /** Start to finish (or to giving up), whole seconds. */
    seconds: integer("seconds").notNull(),
    completed: boolean("completed").notNull(),
    /** The machine crashed during the attempt (a task's score is capped). */
    crashed: boolean("crashed").notNull().default(false),
    /** 0–100, finished tasks only; from the volumes below. */
    score: integer("score"),
    /** The measured part, mm³: material left on, over-cut, what the drawing removes. */
    leftMm3: real("leftMm3"),
    overcutMm3: real("overcutMm3"),
    toRemoveMm3: real("toRemoveMm3"),
    /** gzip of the attempt's action log, JSON. */
    actionLog: bytea("actionLog"),
    logBytes: integer("logBytes"),
    createdAt: created(),
  },
  (t) => [index("attempt_user_level_idx").on(t.userId, t.levelId, t.startedAt)],
);

/**
 * A machined part on a shelf in the warehouse. `field` is the gzip of the
 * stock's distance field at the voxel it was cut with; `preview` the same
 * field resampled coarse, for the shelf. Both are meshed in the browser.
 */
export const part = pgTable(
  "part",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    machineId: text("machineId").notNull(),
    name: text("name").notNull(),
    material: text("material").notNull(),
    /** Blank size, mm: [x, y, z]. */
    stock: jsonb("stock").$type<[number, number, number]>().notNull(),
    /** Where it was made: "freeplay" or "task". */
    source: text("source").notNull(),
    levelId: text("levelId"),
    /** Task score, 0–100. */
    score: integer("score"),
    program: text("program").notNull(),
    /** The designer's part, when it came from one. */
    design: jsonb("design"),
    cycleSeconds: real("cycleSeconds"),
    volumeMm3: real("volumeMm3"),
    field: bytea("field").notNull(),
    preview: bytea("preview").notNull(),
    /** Both payloads together, for the quota. */
    bytes: integer("bytes").notNull(),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("part_user_idx").on(t.userId, t.createdAt)],
);

/**
 * What a trainee has loaded in a machine's tool changer for free play: tool
 * number → a tool of the crib (src/entities/tooling). One small row per user
 * and machine; levels always use the standard set and never read it.
 */
export const toolLoadout = pgTable(
  "tool_loadout",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    machineId: text("machineId").notNull(),
    /** [{ number, assembly }], tool number order. */
    tools: jsonb("tools").$type<{ number: number; assembly: string }[]>().notNull(),
    updatedAt: updated(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.machineId] })],
);
