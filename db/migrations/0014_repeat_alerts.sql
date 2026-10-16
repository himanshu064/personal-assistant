ALTER TABLE "user_settings" ADD COLUMN "default_alert_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "alert_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "alerts_sent" integer DEFAULT 0 NOT NULL;