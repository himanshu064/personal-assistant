import "server-only";
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiKeys, user, userSettings } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { DEFAULT_LEAD_MINUTES } from "@/lib/validation/reminders";
import { MODEL_CATALOG, resolveModelChoice } from "./models";
import type { AiProvider } from "./providers";
import { withUsage, type AiFeature } from "./usage";

export type DraftContext = {
  /** Saved timezone, or null for a brand new user. */
  timezone: string | null;
  defaultLeadMinutes: number;
  defaultAlertCount: number;
  /** The model the user picked, built with their own key; null without a key for that provider. */
  model: LanguageModel | null;
  /** The cheapest (and fastest) model of the same provider and key: the mic, reminder drafts, project memory and Gmail. */
  cheapModel: LanguageModel | null;
  /** The provider and model id behind `model`, shown with chat answers. */
  provider: AiProvider;
  modelId: string;
};

/**
 * Everything drafting a reminder needs, in ONE database round trip: the user
 * row joined to their settings and the keys in use (0 to 2 key rows).
 * Every call the returned models make is recorded under `feature`.
 *
 * Not cached on purpose: the decrypted key must never land in a cache.
 */
export async function getDraftContext(userId: string, feature: AiFeature): Promise<DraftContext> {
  const rows = await db
    .select({
      timezone: userSettings.timezone,
      provider: userSettings.provider,
      model: userSettings.model,
      defaultLeadMinutes: userSettings.defaultLeadMinutes,
      defaultAlertCount: userSettings.defaultAlertCount,
      keyId: aiKeys.id,
      keyProvider: aiKeys.provider,
      encryptedKey: aiKeys.encryptedKey,
    })
    .from(user)
    .leftJoin(userSettings, eq(userSettings.userId, user.id))
    .leftJoin(aiKeys, and(eq(aiKeys.userId, user.id), eq(aiKeys.isActive, true)))
    .where(eq(user.id, userId));

  const first = rows[0];
  const choice = resolveModelChoice({ provider: first?.provider ?? null, model: first?.model ?? null });
  const key = rows.find((r) => r.keyProvider === choice.provider);
  const apiKey = key?.encryptedKey ? decrypt(key.encryptedKey) : null;
  const build = (modelId: string) =>
    withUsage(buildModel(choice.provider, apiKey!, modelId), { userId, keyId: key!.keyId!, provider: choice.provider, model: modelId, feature });
  const cheapId = MODEL_CATALOG.providers[choice.provider].defaultModel;

  return {
    timezone: first?.timezone ?? null,
    defaultLeadMinutes: first?.defaultLeadMinutes ?? DEFAULT_LEAD_MINUTES,
    defaultAlertCount: first?.defaultAlertCount ?? 1,
    model: apiKey ? build(choice.model) : null,
    cheapModel: apiKey ? build(cheapId) : null,
    provider: choice.provider,
    modelId: choice.model,
  };
}

function buildModel(provider: AiProvider, apiKey: string, modelId: string) {
  return provider === "anthropic" ? createAnthropic({ apiKey })(modelId) : createGoogle({ apiKey })(modelId);
}
