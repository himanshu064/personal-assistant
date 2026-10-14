/** Shared between server and browser: no secrets or env here. */
export const AI_PROVIDERS = ["anthropic", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  google: "Gemini (Google)",
};

/** Where users create a key, shown next to the key field. */
export const PROVIDER_KEY_URLS: Record<AiProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
};
