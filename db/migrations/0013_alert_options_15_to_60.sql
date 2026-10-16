ALTER TABLE "user_settings" ALTER COLUMN "default_lead_minutes" SET DEFAULT 15;--> statement-breakpoint
-- "At the time" and other values no longer offered become the first option, 15 minutes before.
UPDATE "user_settings" SET "default_lead_minutes" = 15 WHERE "default_lead_minutes" NOT IN (15, 30, 45, 60);
