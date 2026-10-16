import type { Metadata } from "next";
import { Suspense } from "react";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SettingsSection } from "@/components/settings/settings-section";
import { FormCardSkeleton } from "@/components/common/skeletons";
import { getMyModelOptions } from "@/lib/ai/list-models";
import { MODEL_CATALOG } from "@/lib/ai/models";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getMySettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Settings" };

export default function GeneralSettingsPage() {
  return (
    <SettingsSection title="Preferences" description="Your timezone sets reminder times. The provider and model power every AI feature.">
      <Suspense fallback={<FormCardSkeleton fields={5} />}>
        <General />
      </Suspense>
    </SettingsSection>
  );
}

async function General() {
  const [settings, options] = await Promise.all([getMySettings(), getMyModelOptions()]);
  return (
    <PreferencesForm
      catalog={{
        anthropic: { defaultModel: MODEL_CATALOG.providers.anthropic.defaultModel, models: options.anthropic },
        google: { defaultModel: MODEL_CATALOG.providers.google.defaultModel, models: options.google },
      }}
      initial={{ timezone: settings.timezone, provider: settings.provider, model: settings.model, defaultLeadMinutes: settings.defaultLeadMinutes, defaultAlertCount: settings.defaultAlertCount }}
      savedProviders={AI_PROVIDERS.filter((p) => settings.keys[p])}
    />
  );
}
