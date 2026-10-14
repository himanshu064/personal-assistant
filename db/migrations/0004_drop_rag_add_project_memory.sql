DROP TABLE "note_chunks" CASCADE;--> statement-breakpoint
DROP TABLE "project_notes" CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "memory" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "memory_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "memory_updated_at" timestamp with time zone;--> statement-breakpoint
DROP TYPE "public"."note_source";--> statement-breakpoint
-- Embeddings are no longer used (project chats use memory instead of RAG).
DROP EXTENSION IF EXISTS vector;
