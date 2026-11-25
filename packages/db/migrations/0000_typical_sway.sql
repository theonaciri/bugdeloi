CREATE TABLE "article_status" (
	"article_id" text PRIMARY KEY NOT NULL,
	"level" text DEFAULT 'N0' NOT NULL,
	"flags" text[] DEFAULT '{}'::text[] NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"subject" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"claim" text NOT NULL,
	"legal_units" text[] DEFAULT '{}'::text[] NOT NULL,
	"certificate" jsonb NOT NULL,
	"detector" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_fingerprint" (
	"fingerprint" text NOT NULL,
	"finding_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"archive" text NOT NULL,
	"archive_sha256" text,
	"scope" text[] DEFAULT '{}'::text[] NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "legal_article" (
	"id" text PRIMARY KEY NOT NULL,
	"text_id" text NOT NULL,
	"section_id" text,
	"num" text,
	"article_key" text,
	"etat" text,
	"type" text,
	"date_debut" date,
	"date_fin" date,
	"position" integer DEFAULT 0 NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"text_sha256" text NOT NULL,
	"nota_html" text,
	"version_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('french', coalesce(num, '') || ' ' || content_text)) STORED,
	"last_run_id" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_link" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"type_lien" text NOT NULL,
	"sens" text NOT NULL,
	"target_id" text,
	"target_cid" text,
	"target_num" text,
	"target_text_num" text,
	"target_nature" text,
	"target_date" date,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "legal_section" (
	"id" text PRIMARY KEY NOT NULL,
	"text_id" text NOT NULL,
	"parent_id" text,
	"path" "ltree" NOT NULL,
	"depth" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"etat" text,
	"date_debut" date,
	"date_fin" date,
	"last_run_id" integer
);
--> statement-breakpoint
CREATE TABLE "legal_text" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"short_title" text,
	"nature" text,
	"etat" text,
	"date_debut" date,
	"date_fin" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_coverage" (
	"source" text NOT NULL,
	"source_commit" text NOT NULL,
	"legiarti" text NOT NULL,
	"file" text NOT NULL,
	"line" integer,
	"heading" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reference_coverage_source_legiarti_file_pk" PRIMARY KEY("source","legiarti","file")
);
--> statement-breakpoint
CREATE TABLE "replication_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"catala_version" text,
	"image_digest" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"log_url" text
);
--> statement-breakpoint
ALTER TABLE "article_status" ADD CONSTRAINT "article_status_article_id_legal_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."legal_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_fingerprint" ADD CONSTRAINT "finding_fingerprint_finding_id_finding_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."finding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_article" ADD CONSTRAINT "legal_article_text_id_legal_text_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."legal_text"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_link" ADD CONSTRAINT "legal_link_article_id_legal_article_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."legal_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_section" ADD CONSTRAINT "legal_section_text_id_legal_text_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."legal_text"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_status_level_idx" ON "article_status" USING btree ("level");--> statement-breakpoint
CREATE INDEX "event_ts_brin" ON "event" USING brin ("ts");--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "event" USING btree ("type");--> statement-breakpoint
CREATE INDEX "finding_type_status_idx" ON "finding" USING btree ("type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "finding_fingerprint_uq" ON "finding_fingerprint" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "legal_article_text_num_idx" ON "legal_article" USING btree ("text_id","num");--> statement-breakpoint
CREATE INDEX "legal_article_section_idx" ON "legal_article" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "legal_article_key_idx" ON "legal_article" USING btree ("article_key");--> statement-breakpoint
CREATE INDEX "legal_article_etat_idx" ON "legal_article" USING btree ("etat");--> statement-breakpoint
CREATE INDEX "legal_article_search_gin" ON "legal_article" USING gin ("search");--> statement-breakpoint
CREATE INDEX "legal_link_article_idx" ON "legal_link" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "legal_link_target_idx" ON "legal_link" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "legal_section_path_gist" ON "legal_section" USING gist ("path");--> statement-breakpoint
CREATE INDEX "legal_section_text_idx" ON "legal_section" USING btree ("text_id");--> statement-breakpoint
CREATE INDEX "legal_section_parent_idx" ON "legal_section" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "reference_coverage_legiarti_idx" ON "reference_coverage" USING btree ("legiarti");