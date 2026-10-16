ALTER TABLE "user_settings" ADD COLUMN "meeting_lead_minutes" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "event_uid" text;--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_user_event_uidx" ON "reminders" USING btree ("user_id","event_uid") WHERE "reminders"."event_uid" is not null;