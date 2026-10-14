import type { Metadata } from "next";
import { Suspense } from "react";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { SettingsSection } from "@/components/settings/settings-section";
import { FormCardSkeleton } from "@/components/common/skeletons";
import { MODEL_CATALOG } from "@/lib/ai/models";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { getMySettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Settings" };

export default function GeneralSettingsPage() {
  return (
    <SettingsSection title="Preferences" description="Your timezone sets reminder times. The provider and model power every AI feature.">
      <Suspense fallback={<FormCardSkeleton fields={4} />}>
        <General />
      </Suspense>
    </SettingsSection>
  );
}

async function General() {
  const settings = await getMySettings();
  return (
    <PreferencesForm
      catalog={MODEL_CATALOG}
      initial={{ timezone: settings.timezone, provider: settings.provider, model: settings.model, defaultLeadMinutes: settings.defaultLeadMinutes }}
      savedProviders={AI_PROVIDERS.filter((p) => settings.keys[p])}
    />
  );
}
