ALTER TABLE "chat_messages" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "model" text;