import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiKeys } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { getMySettings } from "@/lib/data/settings";
import { MODEL_CATALOG } from "./models";
import { AI_PROVIDERS, type AiProvider } from "./providers";

export type ModelOption = { id: string; label: string };
export type ModelOptions = Record<AiProvider, ModelOption[]>;

/** Gemini models that are not for text chat (images, speech, live audio, embeddings...). */
const NOT_CHAT = /embedding|image|imagen|tts|audio|live|robotics|computer-use|veo/i;

/**
 * The models each provider offers to the signed in user's key in use, for
 * the Model picker. The provider's cheapest model is always first, so the
 * picker works before a key is saved or when a list cannot be read.
 */
export async function getMyModelOptions(): Promise<ModelOptions> {
  const settings = await getMySettings();
  const entries = await Promise.all(
    AI_PROVIDERS.map(async (provider) => {
      const key = settings.keyList.find((k) => k.provider === provider && k.isActive);
      const live = key
        ? await listModels(key.id).catch((error) => {
            console.warn("ai.list_models_failed", { provider, message: error instanceof Error ? error.message : String(error) });
            return [];
          })
        : [];
      const fallback = MODEL_CATALOG.providers[provider].defaultModel;
      const options = [{ id: fallback, label: fallback }, ...live.filter((m) => m.id !== fallback)];
      // A saved model the list no longer shows stays selectable, so the picker is never blank.
      if (settings.provider === provider && !options.some((m) => m.id === settings.model)) options.push({ id: settings.model, label: settings.model });
      return [provider, options] as const;
    }),
  );
  return Object.fromEntries(entries) as ModelOptions;
}

/**
 * One key's models, asked from the provider (a free list call) and cached for
 * an hour per key. The key id comes from the user's own settings above, and
 * the decrypted key never leaves this function. A failed call throws, so
 * failures are not cached.
 */
async function listModels(keyId: string): Promise<ModelOption[]> {
  "use cache";
  cacheTag(`ai-key:${keyId}:models`);
  cacheLife("hours");

  const [key] = await db.select({ provider: aiKeys.provider, encryptedKey: aiKeys.encryptedKey }).from(aiKeys).where(eq(aiKeys.id, keyId)).limit(1);
  if (!key) return [];
  const apiKey = decrypt(key.encryptedKey);
  return key.provider === "anthropic" ? listAnthropic(apiKey) : listGoogle(apiKey);
}

/** Newest first, as the Models API returns them. */
async function listAnthropic(apiKey: string): Promise<ModelOption[]> {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 10_000 });
  const models: ModelOption[] = [];
  for await (const model of client.models.list()) models.push({ id: model.id, label: model.display_name });
  return models;
}

type GoogleModelsPage = {
  models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  nextPageToken?: string;
};

async function listGoogle(apiKey: string): Promise<ModelOption[]> {
  const models: ModelOption[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    // The key goes in a header, never in the URL (URLs end up in logs).
    const res = await fetch(url, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Google models list failed: ${res.status}`);
    const page = (await res.json()) as GoogleModelsPage;
    for (const m of page.models ?? []) {
      const id = m.name.replace(/^models\//, "");
      if (id.startsWith("gemini-") && m.supportedGenerationMethods?.includes("generateContent") && !NOT_CHAT.test(id)) {
        models.push({ id, label: m.displayName ?? id });
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return models;
}
