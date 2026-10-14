CREATE TYPE "public"."email_item_found_by" AS ENUM('invite', 'ai');--> statement-breakpoint
CREATE TYPE "public"."email_item_kind" AS ENUM('meeting', 'reminder', 'deadline');--> statement-breakpoint
CREATE TYPE "public"."email_item_status" AS ENUM('new', 'added', 'dismissed', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."gmail_sync_status" AS ENUM('active', 'needs_reconnect');--> statement-breakpoint
CREATE TABLE "email_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"from_name" text NOT NULL,
	"from_address" text NOT NULL,
	"subject" text NOT NULL,
	"snippet" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"status" "email_item_status" DEFAULT 'new' NOT NULL,
	"kind" "email_item_kind",
	"found_by" "email_item_found_by",
	"title" text,
	"starts_at" timestamp with time zone,
	"location" text,
	"link" text,
	"reminder_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gmail_sync" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text,
	"status" "gmail_sync_status" DEFAULT 'active' NOT NULL,
	"problem" text,
	"last_synced_at" timestamp with time zone,
	"sync_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD CONSTRAINT "gmail_sync_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD CONSTRAINT "gmail_sync_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_items_user_message_idx" ON "email_items" USING btree ("user_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX "email_items_user_status_received_idx" ON "email_items" USING btree ("user_id","status","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_items_reminder_idx" ON "email_items" USING btree ("reminder_id") WHERE "email_items"."reminder_id" is not null;--> statement-breakpoint
CREATE INDEX "gmail_sync_due_idx" ON "gmail_sync" USING btree ("last_synced_at") WHERE "gmail_sync"."status" = 'active';