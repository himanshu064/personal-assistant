"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { db } from "@/db";
import { aiKeys, gmailSync, googleOauthClients, userSettings } from "@/db/schema";
import { getMyModelOptions } from "@/lib/ai/list-models";
import { MODEL_CATALOG, modelBelongsTo, resolveModelChoice } from "@/lib/ai/models";
import { PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { verifyApiKey } from "@/lib/ai/verify-key";
import { decrypt, encrypt } from "@/lib/crypto";
import { inboxTag } from "@/lib/data/inbox-tags";
import { settingsTag } from "@/lib/data/settings";
import { getGoogleClient, gmailRedirectUri, requestOrigin, testGoogleClient } from "@/lib/gmail/google-oauth";
import { requireUser } from "@/lib/session";
import { apiKeySchema, googleClientSchema, isValidTimezone, keyIdSchema, preferencesSchema } from "@/lib/validation/settings";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; field?: string };

export async function savePreferences(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields." };

  const { timezone, provider, model, defaultLeadMinutes } = parsed.data;
  if (!isValidTimezone(timezone)) return { ok: false, error: "Unknown timezone.", field: "timezone" };
  // Only a model the user's own key lists (or the built in default). The list is cached per key.
  const options = await getMyModelOptions();
  if (!options[provider].some((m) => m.id === model)) return { ok: false, error: "That model is not available with your key.", field: "model" };

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

/** Checks a new key with the provider, then saves it. The first key for a provider is put in use. */
export async function saveApiKey(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the key.", field: issue?.path[0] === "label" ? "label" : "apiKey" };
  }
  const { provider, apiKey } = parsed.data;

  const existing = await db
    .select({ encryptedKey: aiKeys.encryptedKey, isActive: aiKeys.isActive })
    .from(aiKeys)
    .where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, provider)));
  if (existing.some((k) => decrypt(k.encryptedKey) === apiKey)) {
    return { ok: false, error: "This key is already saved.", field: "apiKey" };
  }

  const check = await verifyApiKey(provider, apiKey);
  if (!check.ok) return { ok: false, error: check.message, field: "apiKey" };

  const isActive = !existing.some((k) => k.isActive);
  const label = parsed.data.label || `Key ${existing.length + 1}`;
  await db.insert(aiKeys).values({ userId: user.id, provider, label, encryptedKey: encrypt(apiKey), last4: apiKey.slice(-4), isActive });
  const switched = isActive ? await switchToProviderWithKey(user.id, provider) : null;
  updateTag(settingsTag(user.id));
  return { ok: true, message: `Key checked and saved.${switchedMessage(switched)}` };
}

/** "Use this key": puts the key in use for its provider, and makes that provider the one every AI feature uses. */
export async function selectApiKey(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = keyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown key." };

  // Both reads at once, then the writes in one transaction.
  const [[key], [settings]] = await Promise.all([
    db
      .select({ provider: aiKeys.provider, label: aiKeys.label })
      .from(aiKeys)
      .where(and(eq(aiKeys.id, parsed.data.id), eq(aiKeys.userId, user.id)))
      .limit(1),
    db.select({ model: userSettings.model }).from(userSettings).where(eq(userSettings.userId, user.id)).limit(1),
  ]);
  if (!key) return { ok: false, error: "This key no longer exists." };
  // Keep the chosen model when the provider offers it, else its cheapest.
  const model = settings?.model && modelBelongsTo(key.provider, settings.model) ? settings.model : MODEL_CATALOG.providers[key.provider].defaultModel;

  await db.transaction(async (tx) => {
    // Off first, then on: the unique index allows one key in use per provider.
    await tx.update(aiKeys).set({ isActive: false }).where(and(eq(aiKeys.userId, user.id), eq(aiKeys.provider, key.provider), eq(aiKeys.isActive, true)));
    await tx.update(aiKeys).set({ isActive: true }).where(eq(aiKeys.id, parsed.data.id));
    await tx
      .insert(userSettings)
      .values({ userId: user.id, provider: key.provider, model })
      .onConflictDoUpdate({ target: userSettings.userId, set: { provider: key.provider, model } });
  });
  updateTag(settingsTag(user.id));
  return { ok: true, message: `Now using "${key.label}" (${PROVIDER_LABELS[key.provider]}).` };
}

/** Removes a key. If it was in use, the newest other key of the same provider takes over. */
export async function deleteApiKey(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = keyIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown key." };

  const [removed] = await db
    .delete(aiKeys)
    .where(and(eq(aiKeys.id, parsed.data.id), eq(aiKeys.userId, user.id)))
    .returning({ provider: aiKeys.provider, isActive: aiKeys.isActive });
  if (!removed) return { ok: false, error: "This key no longer exists." };

  let next: string | null = null;
  if (removed.isActive) {
    const [replacement] = await db
      .update(aiKeys)
      .set({ isActive: true })
      .where(
        eq(
          aiKeys.id,
          sql`(select id from ai_keys where user_id = ${user.id} and provider = ${removed.provider} order by created_at desc limit 1)`,
        ),
      )
      .returning({ label: aiKeys.label });
    next = replacement?.label ?? null;
  }
  // Only removing the last key in use for a provider can leave the selected provider without one.
  const switched =
    removed.isActive && !next ? await switchToProviderWithKey(user.id, removed.provider === "anthropic" ? "google" : "anthropic") : null;
  updateTag(settingsTag(user.id));
  return { ok: true, message: `Key removed.${next ? ` Now using "${next}".` : ""}${switchedMessage(switched)}` };
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
    db.select({ provider: aiKeys.provider }).from(aiKeys).where(and(eq(aiKeys.userId, userId), eq(aiKeys.isActive, true))),
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

/** What a Gmail connection becomes when the Google client it was made with changes or goes away. */
const GOOGLE_CLIENT_CHANGED = {
  status: "needs_reconnect" as const,
  problem: "Your Google app changed. Reconnect this Gmail to keep getting suggestions.",
  encryptedRefreshToken: null,
  encryptedAccessToken: null,
  accessTokenExpiresAt: null,
};

/**
 * Saves the user's own Google client for Gmail, after checking it with Google.
 * A new Client ID makes connected Gmails reconnect: Google ties their tokens
 * to the client that issued them. A new secret for the same ID does not.
 */
export async function saveGoogleClient(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = googleClientSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Check the values.", field: issue?.path[0] === "clientSecret" ? "clientSecret" : "clientId" };
  }
  const { clientId, clientSecret } = parsed.data;

  const [check, [existing]] = await Promise.all([
    testGoogleClient({ clientId, clientSecret }, gmailRedirectUri(await requestOrigin())),
    db.select({ clientId: googleOauthClients.clientId }).from(googleOauthClients).where(eq(googleOauthClients.userId, user.id)).limit(1),
  ]);
  if (!check.ok) return { ok: false, error: check.message, field: /secret/i.test(check.message) ? "clientSecret" : "clientId" };

  const values = { clientId, encryptedSecret: encrypt(clientSecret), secretLast4: clientSecret.slice(-4) };
  await db.insert(googleOauthClients).values({ userId: user.id, ...values }).onConflictDoUpdate({ target: googleOauthClients.userId, set: values });
  const reconnect = existing && existing.clientId !== clientId;
  if (reconnect) await db.update(gmailSync).set(GOOGLE_CLIENT_CHANGED).where(eq(gmailSync.userId, user.id));

  updateTag(settingsTag(user.id));
  updateTag(inboxTag(user.id));
  return { ok: true, message: reconnect ? "Google app checked and saved. Reconnect your Gmail in the Inbox." : "Google app checked and saved. You can connect Gmail now." };
}

/** "Test connection": checks the saved Client ID and secret with Google again. */
export async function testSavedGoogleClient(): Promise<ActionResult> {
  const user = await requireUser();
  const client = await getGoogleClient(user.id);
  if (!client) return { ok: false, error: "Save your Google app first." };
  const check = await testGoogleClient(client, gmailRedirectUri(await requestOrigin()));
  return check.ok ? { ok: true, message: "Connection works. Google accepted your Client ID and secret." } : { ok: false, error: check.message };
}

/** Removes the Google client. Connected Gmails stop syncing until a client is added and they are reconnected. */
export async function deleteGoogleClient(): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(googleOauthClients).where(eq(googleOauthClients.userId, user.id));
  await db.update(gmailSync).set(GOOGLE_CLIENT_CHANGED).where(eq(gmailSync.userId, user.id));
  updateTag(settingsTag(user.id));
  updateTag(inboxTag(user.id));
  return { ok: true, message: "Google app removed. Gmail stops syncing until you add one and reconnect." };
}
