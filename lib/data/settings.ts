import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiKeys, aiUsage, googleOauthClients, userSettings } from "@/db/schema";
import { resolveModelChoice } from "@/lib/ai/models";
import { DEFAULT_LEAD_MINUTES } from "@/lib/validation/reminders";
import { requireUser } from "@/lib/session";

export const settingsTag = (userId: string) => `user:${userId}:settings`;

export type SettingsView = Awaited<ReturnType<typeof getSettingsForUser>>;

/** The signed in user's settings. Never returns key contents, only the last 4 characters. */
export async function getMySettings() {
  const user = await requireUser();
  return getSettingsForUser(user.id);
}

// Not exported: callers must go through getMySettings, so nobody can read
// another user's settings by passing a different id.
async function getSettingsForUser(userId: string) {
  "use cache";
  cacheTag(settingsTag(userId));
  cacheLife("minutes");

  // Two independent reads, run in parallel.
  const [[settings], keys] = await Promise.all([
    db
      .select({
        timezone: userSettings.timezone,
        provider: userSettings.provider,
        model: userSettings.model,
        defaultLeadMinutes: userSettings.defaultLeadMinutes,
        defaultAlertCount: userSettings.defaultAlertCount,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    db
      .select({
        id: aiKeys.id,
        provider: aiKeys.provider,
        label: aiKeys.label,
        last4: aiKeys.last4,
        isActive: aiKeys.isActive,
        updatedAt: aiKeys.updatedAt,
      })
      .from(aiKeys)
      .where(eq(aiKeys.userId, userId))
      .orderBy(aiKeys.createdAt),
  ]);

  const choice = resolveModelChoice({ provider: settings?.provider ?? null, model: settings?.model ?? null });
  return {
    timezone: settings?.timezone ?? null,
    provider: choice.provider,
    model: choice.model,
    defaultLeadMinutes: settings?.defaultLeadMinutes ?? DEFAULT_LEAD_MINUTES,
    defaultAlertCount: settings?.defaultAlertCount ?? 1,
    /** The key in use per provider. */
    keys: Object.fromEntries(keys.filter((k) => k.isActive).map((k) => [k.provider, { last4: k.last4, updatedAt: k.updatedAt }])) as Partial<
      Record<(typeof keys)[number]["provider"], { last4: string; updatedAt: Date }>
    >,
    /** Every saved key, oldest first. */
    keyList: keys,
  };
}

export type KeyUsageRow = {
  keyId: string | null;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Tokens used in the last 30 days, per key and model, most used first. Not
 * cached: it changes with every AI call, and the page reads it on demand.
 */
export async function getMyKeyUsage(): Promise<KeyUsageRow[]> {
  const user = await requireUser();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const total = sql<number>`sum(${aiUsage.inputTokens} + ${aiUsage.outputTokens})`;
  return db
    .select({
      keyId: aiUsage.keyId,
      model: aiUsage.model,
      calls: sql<number>`count(*)`.mapWith(Number),
      inputTokens: sql<number>`sum(${aiUsage.inputTokens})`.mapWith(Number),
      outputTokens: sql<number>`sum(${aiUsage.outputTokens})`.mapWith(Number),
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, user.id), gt(aiUsage.createdAt, since)))
    .groupBy(aiUsage.keyId, aiUsage.model)
    .orderBy(desc(total));
}

/** The user's own Google client for Gmail, or null. Never the secret, only its last 4 characters. */
export async function getMyGoogleClient() {
  const user = await requireUser();
  return readGoogleClient(user.id);
}

async function readGoogleClient(userId: string) {
  "use cache";
  cacheTag(settingsTag(userId));
  cacheLife("minutes");
  const [row] = await db
    .select({ clientId: googleOauthClients.clientId, secretLast4: googleOauthClients.secretLast4, updatedAt: googleOauthClients.updatedAt })
    .from(googleOauthClients)
    .where(eq(googleOauthClients.userId, userId))
    .limit(1);
  return row ?? null;
}
