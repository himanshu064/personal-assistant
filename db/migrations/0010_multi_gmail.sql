-- Several Gmails per user: gmail_sync is keyed by the Google account, not the user.
ALTER TABLE "gmail_sync" DROP CONSTRAINT "gmail_sync_pkey";--> statement-breakpoint
ALTER TABLE "gmail_sync" ADD PRIMARY KEY ("account_id");--> statement-breakpoint
ALTER TABLE "email_items" ADD COLUMN "account_id" uuid;--> statement-breakpoint
-- Until now each user had at most one Gmail, so its items belong to that account.
UPDATE "email_items" e SET "account_id" = g."account_id" FROM "gmail_sync" g WHERE g."user_id" = e."user_id";--> statement-breakpoint
DELETE FROM "email_items" WHERE "account_id" IS NULL;--> statement-breakpoint
ALTER TABLE "email_items" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "email_items" ADD CONSTRAINT "email_items_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_items_account_idx" ON "email_items" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "gmail_sync_user_idx" ON "gmail_sync" USING btree ("user_id");
