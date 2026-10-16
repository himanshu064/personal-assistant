ALTER TABLE "user_settings" ALTER COLUMN "default_lead_minutes" SET DEFAULT 20;--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN "meeting_lead_minutes";--> statement-breakpoint
-- Reminders made by hand from an invite suggestion before invites carried their UID: link them, so an updated invite moves them instead of adding a second one.
UPDATE "reminders" r SET "event_uid" = e."event_uid"
  FROM (SELECT DISTINCT ON ("user_id", "event_uid") "user_id", "event_uid", "reminder_id" FROM "email_items"
         WHERE "reminder_id" IS NOT NULL AND "event_uid" IS NOT NULL ORDER BY "user_id", "event_uid", "received_at" DESC) e
 WHERE r."id" = e."reminder_id" AND r."event_uid" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "reminders" x WHERE x."user_id" = r."user_id" AND x."event_uid" = e."event_uid");
