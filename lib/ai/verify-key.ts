import "server-only";
import { APICallError, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { MODEL_CATALOG } from "./models";
import type { AiProvider } from "./providers";

/**
 * Checks a key with the smallest possible request (one output token on the
 * cheapest model), so a wrong key is caught when saved, not mid reminder.
 */
export async function verifyApiKey(provider: AiProvider, apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const modelId = MODEL_CATALOG.providers[provider].defaultModel;
  const model = provider === "anthropic" ? createAnthropic({ apiKey })(modelId) : createGoogle({ apiKey })(modelId);

  try {
    await generateText({ model, prompt: "Reply with OK.", maxOutputTokens: 1, maxRetries: 0 });
    return { ok: true };
  } catch (error) {
    const status = APICallError.isInstance(error) ? error.statusCode : undefined;
    if (status === 400 && APICallError.isInstance(error) && /not scoped to a workspace/i.test(error.responseBody ?? error.message)) {
      return { ok: false, message: "This key isn't tied to a workspace. Create a key inside a workspace in the Anthropic Console and use that one." };
    }
    if (status === 400 || status === 401 || status === 403) {
      return { ok: false, message: "This key was rejected. Check that you copied all of it." };
    }
    if (status === 429) {
      return { ok: false, message: "This key has no quota left or is rate limited. Check your plan with the provider." };
    }
    console.warn("ai.verify-key.failed", { provider, status, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, message: "We could not reach the provider to check this key. Try again in a moment." };
  }
}
