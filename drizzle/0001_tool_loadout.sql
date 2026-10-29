CREATE TABLE "tool_loadout" (
	"userId" text NOT NULL,
	"machineId" text NOT NULL,
	"tools" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tool_loadout_userId_machineId_pk" PRIMARY KEY("userId","machineId")
);
--> statement-breakpoint
ALTER TABLE "tool_loadout" ADD CONSTRAINT "tool_loadout_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;