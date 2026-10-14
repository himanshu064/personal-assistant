import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { KeyCardsSkeleton } from "@/components/common/skeletons";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getMySettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "AI keys" };

export default function ApiKeysPage() {
  return (
    <SettingsSection
      title="AI keys"
      description="Your own keys power the AI features. They are encrypted, and only the last 4 characters are ever shown."
    >
      <Suspense fallback={<KeyCardsSkeleton />}>
        <Keys />
      </Suspense>
    </SettingsSection>
  );
}

async function Keys() {
  const settings = await getMySettings();
  return (
    <div className="flex flex-col gap-4">
      {AI_PROVIDERS.map((provider) => (
        <ApiKeyCard key={provider} provider={provider} saved={settings.keys[provider] ?? null} />
      ))}
    </div>
  );
}
