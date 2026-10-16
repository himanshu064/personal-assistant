CREATE TABLE "google_oauth_clients" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"encrypted_secret" text NOT NULL,
	"secret_last4" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_items" DROP CONSTRAINT "email_items_account_id_account_id_fk";
--> statement-breakpoint
ALTER TABLE "gmail_sync" DROP CONSTRAINT "gmail_sync_account_id_account_id_fk";
--> statement-breakpoint
ALTER TABLE "gmail_sync" ALTER COLUMN "account_id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD COLUMN "encrypted_refresh_token" text;--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD COLUMN "encrypted_access_token" text;--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD COLUMN "access_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "google_oauth_clients" ADD CONSTRAINT "google_oauth_clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_account_id_gmail_sync_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gmail_sync"("account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gmail_sync_user_email_uidx" ON "gmail_sync" USING btree ("user_id","email") WHERE "gmail_sync"."email" is not null;--> statement-breakpoint
-- Gmail tokens were issued to the app's old Google client; a user's own client cannot use them. Keep each connection (and its Inbox history), ask to reconnect.
UPDATE "gmail_sync" SET "status" = 'needs_reconnect', "sync_started_at" = NULL,
  "problem" = 'Gmail now connects through your own Google app. Set it up in Settings > Google, then reconnect.';--> statement-breakpoint
DELETE FROM "account" WHERE "provider_id" = 'google';
