"use server";

import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { aiKeys, userSettings } from "@/db/schema";
import { isAllowedModel, MODEL_CATALOG, resolveModelChoice } from "@/lib/ai/models";
import { PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { verifyApiKey } from "@/lib/ai/verify-key";
import { encrypt } from "@/lib/crypto";
import { settingsTag } from "@/lib/data/settings";
import { requireUser } from "@/lib/session";
import { apiKeySchema, isValidTimezone, preferencesSchema, providerSchema } from "@/lib/validation/settings";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

export async function savePreferences(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." };

  const { timezone, provider, model, defaultLeadMinutes } = parsed.data;
  if (!isValidTimezone(timezone)) return { ok: false, error: "Unknown timezone.", field: "timezone" };
  if (!isAllowedModel(provider, model)) return { ok: false, error: "That model is not available.", field: "model" };

  // One round trip: insert, or update when the row already exists.
  await db
    .insert(userSettings)
    .values({ userId: user.id, timezone, provider, model, defaultLeadMinutes })
    .onConflictDoUpdate({ target: userSettings.userId, set: { timezone, provider, model, defaultLeadMinutes } });

  updateTag(settingsTag(user.id));
  return { ok: true, message: "Preferences saved." };
}

/**
 * Saves the browser's timezone the first time only. A user_settings row is
 * only ever created here or by savePreferences (which always sets a
 * timezone), so "insert, do nothing on conflict" never overwrites a choice
 * and costs no write when a row already exists.
 */
export async function saveDetectedTimezone(timezone: string): Promise<void> {
  const user = await requireUser();
  if (!isValidTimezone(timezone)) return;

  const inserted = await db
    .insert(userSettings)
    .values({ userId: user.id, timezone })
    .onConflictDoNothing({ target: userSettings.userId })
    .returning({ userId: userSettings.userId });

  if (inserted.length > 0) updateTag(settingsTag(user.id));
}

export async function saveApiKey(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the key.", field: "apiKey" };
  }

  const { provider, apiKey } = parsed.data;
  const check = await verifyApiKey(provider, apiKey);
  if (!check.ok) return { ok: false, error: check.message, field: "apiKey" };

  const encryptedKey = encrypt(apiKey);
  const last4 = apiKey.slice(-4);
  await db
    .insert(aiKeys)
    .values({ userId: user.id, provider, encryptedKey, last4 })
    .onConflictDoUpdate({ target: [aiKeys.userId, aiKeys.provider], set: { encryptedKey, last4 } });

  const switched = await switchToProviderWithKey(user.id, provider);
  updateTag(settingsTag(user.id));
  return { ok: true, message: `Key checked and saved.${switchedMessage(switched)}` };
}

export async function deleteApiKey(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown provider." };

  const { provider } = parsed.data;
  await db.delete(aiKeys).where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, provider)));
  const switched = await switchToProviderWithKey(user.id, provider === "anthropic" ? "google" : "anthropic");
  updateTag(settingsTag(user.id));
  return { ok: true, message: `Key removed.${switchedMessage(switched)}` };
}

/**
 * Every AI feature uses only the key of the selected provider, so a key for
 * the other one does nothing on its own. When the selected provider has no
 * key and `candidate` has one, select `candidate` with its cheapest model.
 * Returns the provider switched to, or null when nothing changed.
 */
async function switchToProviderWithKey(userId: string, candidate: AiProvider): Promise<AiProvider | null> {
  const [settingsRows, keyRows] = await Promise.all([
    db.select({ provider: userSettings.provider, model: userSettings.model }).from(userSettings).where(eq(userSettings.userId, userId)),
    db.select({ provider: aiKeys.provider }).from(aiKeys).where(eq(aiKeys.userId, userId)),
  ]);
  const withKey = new Set(keyRows.map((r) => r.provider));
  const selected = resolveModelChoice({ provider: settingsRows[0]?.provider ?? null, model: settingsRows[0]?.model ?? null }).provider;
  if (withKey.has(selected) || !withKey.has(candidate)) return null;

  const model = MODEL_CATALOG.providers[candidate].defaultModel;
  await db
    .insert(userSettings)
    .values({ userId, provider: candidate, model })
    .onConflictDoUpdate({ target: userSettings.userId, set: { provider: candidate, model } });
  return candidate;
}

function switchedMessage(provider: AiProvider | null) {
  return provider ? ` ${PROVIDER_LABELS[provider]} is now your AI provider.` : "";
}
