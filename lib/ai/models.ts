import "server-only";
import { z } from "zod";
import { AI_PROVIDERS, type AiProvider } from "./providers";

const list = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string()).min(1));

/**
 * Model settings from .env. Parsed once at startup so a typo fails loudly
 * instead of silently sending users to a model that does not exist.
 */
const env = z
  .object({
    AI_DEFAULT_PROVIDER: z.enum(AI_PROVIDERS).default("google"),
    AI_DEFAULT_MODEL_ANTHROPIC: z.string().min(1),
    AI_DEFAULT_MODEL_GOOGLE: z.string().min(1),
    AI_ALLOWED_MODELS_ANTHROPIC: list,
    AI_ALLOWED_MODELS_GOOGLE: list,
  })
  .superRefine((v, ctx) => {
    if (!v.AI_ALLOWED_MODELS_ANTHROPIC.includes(v.AI_DEFAULT_MODEL_ANTHROPIC)) {
      ctx.addIssue({ code: "custom", message: "AI_DEFAULT_MODEL_ANTHROPIC must be in AI_ALLOWED_MODELS_ANTHROPIC" });
    }
    if (!v.AI_ALLOWED_MODELS_GOOGLE.includes(v.AI_DEFAULT_MODEL_GOOGLE)) {
      ctx.addIssue({ code: "custom", message: "AI_DEFAULT_MODEL_GOOGLE must be in AI_ALLOWED_MODELS_GOOGLE" });
    }
  })
  .parse(process.env);

export type ModelCatalog = {
  defaultProvider: AiProvider;
  providers: Record<AiProvider, { defaultModel: string; models: string[] }>;
};

export const MODEL_CATALOG: ModelCatalog = {
  defaultProvider: env.AI_DEFAULT_PROVIDER,
  providers: {
    anthropic: { defaultModel: env.AI_DEFAULT_MODEL_ANTHROPIC, models: env.AI_ALLOWED_MODELS_ANTHROPIC },
    google: { defaultModel: env.AI_DEFAULT_MODEL_GOOGLE, models: env.AI_ALLOWED_MODELS_GOOGLE },
  },
};

export function isAllowedModel(provider: AiProvider, model: string) {
  return MODEL_CATALOG.providers[provider].models.includes(model);
}

/**
 * The provider and model a user actually gets: their saved choice when it is
 * still allowed, otherwise the defaults (the cheapest models).
 */
export function resolveModelChoice(saved: { provider: AiProvider | null; model: string | null }) {
  const provider = saved.provider ?? MODEL_CATALOG.defaultProvider;
  const model =
    saved.model && isAllowedModel(provider, saved.model) ? saved.model : MODEL_CATALOG.providers[provider].defaultModel;
  return { provider, model };
}
