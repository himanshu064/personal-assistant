import "server-only";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiKeys, user, userSettings } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { resolveModelChoice } from "./models";
import type { AiProvider } from "./providers";

export type DraftContext = {
  /** Saved timezone, or null for a brand new user. */
  timezone: string | null;
  defaultLeadMinutes: number;
  /** The model the user picked, built with their own key; null without a key for that provider. */
  model: LanguageModel | null;
};

/**
 * Everything drafting a reminder needs, in ONE database round trip: the user
 * row joined to their settings and keys (0 to 2 key rows).
 *
 * Not cached on purpose: the decrypted key must never land in a cache.
 */
export async function getDraftContext(userId: string): Promise<DraftContext> {
  const rows = await db
    .select({
      timezone: userSettings.timezone,
      provider: userSettings.provider,
      model: userSettings.model,
      defaultLeadMinutes: userSettings.defaultLeadMinutes,
      keyProvider: aiKeys.provider,
      encryptedKey: aiKeys.encryptedKey,
    })
    .from(user)
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .leftJoin(aiKeys, eq(aiKeys.userId, user.id))
    .where(eq(user.id, userId));

  const first = rows[0];
  const choice = resolveModelChoice({ provider: first?.provider ?? null, model: first?.model ?? null });
  const key = rows.find((r) => r.keyProvider === choice.provider)?.encryptedKey;

  return {
    timezone: first?.timezone ?? null,
    defaultLeadMinutes: first?.defaultLeadMinutes ?? 0,
    model: key ? buildModel(choice.provider, decrypt(key), choice.model) : null,
  };
}

function buildModel(provider: AiProvider, apiKey: string, modelId: string): LanguageModel {
  return provider === "anthropic" ? createAnthropic({ apiKey })(modelId) : createGoogle({ apiKey })(modelId);
}
