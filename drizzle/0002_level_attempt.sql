CREATE TABLE "level_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"machineId" text NOT NULL,
	"levelId" text NOT NULL,
	"startedAt" timestamp NOT NULL,
	"seconds" integer NOT NULL,
	"completed" boolean NOT NULL,
	"crashed" boolean DEFAULT false NOT NULL,
	"score" integer,
	"leftMm3" real,
	"overcutMm3" real,
	"toRemoveMm3" real,
	"actionLog" "bytea",
	"logBytes" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_attempt" ADD CONSTRAINT "level_attempt_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_user_level_idx" ON "level_attempt" USING btree ("userId","levelId","startedAt");