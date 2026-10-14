import { pgEnum } from "drizzle-orm/pg-core";

export const aiProviderEnum = pgEnum("ai_provider", ["anthropic", "google"]);
