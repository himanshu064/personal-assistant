import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/app-shell/page-header";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { Skeleton } from "@/components/ui/skeleton";
import { MODEL_CATALOG } from "@/lib/ai/models";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getMySettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your timezone, AI model and API keys." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </PageContainer>
  );
}

async function SettingsContent() {
  const settings = await getMySettings();
  return (
    <div className="flex flex-col gap-6">
      <PreferencesForm
        catalog={MODEL_CATALOG}
        initial={{ timezone: settings.timezone, provider: settings.provider, model: settings.model }}
        savedProviders={AI_PROVIDERS.filter((p) => settings.keys[p])}
      />
      <section className="flex flex-col gap-3" aria-labelledby="api-keys-heading">
        <div>
          <h2 id="api-keys-heading" className="text-base font-semibold">
            API keys
          </h2>
          <p className="text-sm text-muted-foreground">
            Your own keys power the AI features. They are encrypted and never shown again after saving.
          </p>
        </div>
        {AI_PROVIDERS.map((provider) => (
          <ApiKeyCard key={provider} provider={provider} saved={settings.keys[provider] ?? null} />
        ))}
      </section>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
