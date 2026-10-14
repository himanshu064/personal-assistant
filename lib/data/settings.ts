import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiKeys, userSettings } from "@/db/schema";
import { resolveModelChoice } from "@/lib/ai/models";
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
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    db
      .select({ provider: aiKeys.provider, last4: aiKeys.last4, updatedAt: aiKeys.updatedAt })
      .from(aiKeys)
      .where(eq(aiKeys.userId, userId)),
  ]);

  const choice = resolveModelChoice({ provider: settings?.provider ?? null, model: settings?.model ?? null });
  return {
    timezone: settings?.timezone ?? null,
    provider: choice.provider,
    model: choice.model,
    defaultLeadMinutes: settings?.defaultLeadMinutes ?? 0,
    keys: Object.fromEntries(keys.map((k) => [k.provider, { last4: k.last4, updatedAt: k.updatedAt }])) as Partial<
      Record<(typeof keys)[number]["provider"], { last4: string; updatedAt: Date }>
    >,
  };
}
