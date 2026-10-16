CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_id" uuid,
	"provider" "ai_provider" NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "ai_keys_user_provider_uidx";--> statement-breakpoint
ALTER TABLE "ai_keys" ADD COLUMN "label" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_keys" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Keys saved before this change were the only key for their provider, so each is the one in use.
UPDATE "ai_keys" SET "is_active" = true, "label" = 'My key';--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_key_id_ai_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."ai_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_created_idx" ON "ai_usage" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_usage_key_idx" ON "ai_usage" USING btree ("key_id") WHERE "ai_usage"."key_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_keys_user_provider_idx" ON "ai_keys" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_keys_user_provider_active_uidx" ON "ai_keys" USING btree ("user_id","provider") WHERE "ai_keys"."is_active";