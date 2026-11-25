CREATE TABLE "legi_state" (
	"text_id" text PRIMARY KEY NOT NULL,
	"archive" text NOT NULL,
	"archive_sha256" text NOT NULL,
	"as_of" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legi_structure" (
	"text_id" text NOT NULL,
	"id" text NOT NULL,
	"title" text,
	"children" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "legi_structure_text_id_id_pk" PRIMARY KEY("text_id","id")
);
--> statement-breakpoint
ALTER TABLE "ingest_run" ADD COLUMN "as_of" date;--> statement-breakpoint
ALTER TABLE "legal_link" ADD COLUMN "target_nor" text;--> statement-breakpoint
ALTER TABLE "legi_state" ADD CONSTRAINT "legi_state_text_id_legal_text_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."legal_text"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legi_structure" ADD CONSTRAINT "legi_structure_text_id_legal_text_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."legal_text"("id") ON DELETE no action ON UPDATE no action;