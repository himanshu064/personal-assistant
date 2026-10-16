import "server-only";
import { after } from "next/server";
import { wrapLanguageModel, type LanguageModel } from "ai";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import type { AiProvider } from "./providers";

/** Which feature made an AI call, shown in Settings > AI keys > Usage. */
export type AiFeature = "chat" | "reminder" | "assistant" | "gmail" | "transcribe";

export type UsageTag = { userId: string; keyId: string; provider: AiProvider; model: string; feature: AiFeature };

/**
 * Wraps a model so every call it makes (generate or stream) saves its token
 * counts to ai_usage. Saving runs after the response and can never fail the call.
 */
export function withUsage(model: Exclude<LanguageModel, string>, tag: UsageTag): LanguageModel {
  return wrapLanguageModel({
    model,
    middleware: {
      wrapGenerate: async ({ doGenerate }) => {
        const result = await doGenerate();
        recordUsage(tag, result.usage.inputTokens.total, result.usage.outputTokens.total);
        return result;
      },
      wrapStream: async ({ doStream }) => {
        const { stream, ...rest } = await doStream();
        return {
          ...rest,
          stream: stream.pipeThrough(
            new TransformStream({
              transform(part, controller) {
                if (part.type === "finish") recordUsage(tag, part.usage.inputTokens.total, part.usage.outputTokens.total);
                controller.enqueue(part);
              },
            }),
          ),
        };
      },
    },
  });
}

export function recordUsage(tag: UsageTag, inputTokens: number | undefined, outputTokens: number | undefined) {
  const save = () =>
    db
      .insert(aiUsage)
      .values({ ...tag, inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0 })
      .then(() => undefined)
      .catch((error) => console.warn("ai.usage_save_failed", { message: error instanceof Error ? error.message : String(error) }));
  // after() keeps a serverless function alive until the row is saved; outside a request, just save.
  try {
    after(save);
  } catch {
    void save();
  }
}
