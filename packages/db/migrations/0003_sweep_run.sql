CREATE TABLE "sweep_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"detectors" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"as_of" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archives" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"articles_checked" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"duration_ms" integer,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "sweep_run_started_idx" ON "sweep_run" USING btree ("started_at");