CREATE TABLE "desk_task" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"payload" jsonb NOT NULL,
	"lease_digest" text,
	"lease_handle" text,
	"lease_family" text,
	"lease_started_at" timestamp with time zone,
	"lease_expires_at" timestamp with time zone,
	"release_reason" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "desk_task_lease_digest_unique" UNIQUE("lease_digest")
);
--> statement-breakpoint
CREATE INDEX "desk_task_open_idx" ON "desk_task" USING btree ("role","id") WHERE "desk_task"."completed_at" is null;