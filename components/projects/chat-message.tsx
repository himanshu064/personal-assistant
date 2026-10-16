"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, RotateCwIcon } from "lucide-react";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import type { ProjectChatMessage } from "@/lib/projects/chat-types";

export function textOf(message: ProjectChatMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/** One message: the user's on the right in a bubble, the assistant's as plain Markdown with copy and retry. */
export function ChatMessage({
  message,
  streaming,
  onRetry,
}: {
  message: ProjectChatMessage;
  streaming?: boolean;
  /** Only on the last answer. */
  onRetry?: () => void;
}) {
  const text = textOf(message);
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <li className="flex justify-end motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <p className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-[15px] whitespace-pre-wrap">{text}</p>
      </li>
    );
  }

  return (
    <li className="group flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Markdown>{text}</Markdown>
      {!streaming && text ? (
        <div className="-ml-2 flex items-center gap-0.5 text-muted-foreground">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copied ? "Copied" : "Copy reply"}
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
          {onRetry ? (
            <Button variant="ghost" size="icon-sm" aria-label="Write this reply again" onClick={onRetry}>
              <RotateCwIcon />
            </Button>
          ) : null}
          {message.metadata?.usage ? <TokenUsage {...message.metadata.usage} /> : null}
        </div>
      ) : null}
    </li>
  );
}

const tokens = new Intl.NumberFormat("en-US");

/** Tokens this answer used, so the user can see what each reply costs. */
function TokenUsage({ inputTokens, outputTokens, model }: { inputTokens: number; outputTokens: number; model: string }) {
  return (
    <span className="ml-2 text-xs tabular-nums" title={`${tokens.format(inputTokens)} tokens sent, ${tokens.format(outputTokens)} tokens in the answer`}>
      {tokens.format(inputTokens + outputTokens)} tokens ({tokens.format(inputTokens)} in, {tokens.format(outputTokens)} out) · <span className="font-mono">{model}</span>
    </span>
  );
}
