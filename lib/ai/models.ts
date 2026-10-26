import "server-only";
import type { AiProvider } from "./providers";

/**
 * Built in defaults: the cheapest model of each provider. Used before a key
 * is saved, for quick and background work (the mic, reminder drafts, project memory, Gmail), and when a
 * provider's model list cannot be read. Every other model a user can pick
 * comes live from their own key (see lib/ai/list-models.ts).
 */
export const MODEL_CATALOG: { defaultProvider: AiProvider; providers: Record<AiProvider, { defaultModel: string }> } = {
  defaultProvider: "google",
  providers: {
    anthropic: { defaultModel: "claude-haiku-5-5" },
    google: { defaultModel: "gemini-2.5-flash-lite" },
  },
};

/** True when the model id is one of that provider's (so a Claude model is never sent to Google). */
export function modelBelongsTo(provider: AiProvider, model: string) {
  return provider === "anthropic" ? model.startsWith("claude-") : model.startsWith("gemini-");
}

/**
 * The provider and model a user actually gets: their saved choice when it
 * belongs to the provider, otherwise the defaults (the cheapest models).
 */
export function resolveModelChoice(saved: { provider: AiProvider | null; model: string | null }) {
  const provider = saved.provider ?? MODEL_CATALOG.defaultProvider;
  const model = saved.model && modelBelongsTo(provider, saved.model) ? saved.model : MODEL_CATALOG.providers[provider].defaultModel;
  return { provider, model };
}
