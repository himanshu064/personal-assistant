CREATE TYPE "public"."reminder_repeat" AS ENUM('none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "repeat" "reminder_repeat" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "repeat_anchor" timestamp with time zone;