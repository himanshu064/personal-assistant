import type { Metadata } from "next";
import { Suspense } from "react";
import { FormCardSkeleton } from "@/components/common/skeletons";
import { GoogleClientCard } from "@/components/settings/google-client-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { getMyGoogleClient } from "@/lib/data/settings";
import { gmailRedirectUri, requestOrigin } from "@/lib/gmail/google-oauth";

export const metadata: Metadata = { title: "Google" };

export default function GoogleSettingsPage(props: PageProps<"/settings/google">) {
  return (
    <SettingsSection
      title="Google (Gmail)"
      description="To read your Gmail, the app uses a Google app you create in Google Cloud. Set it up once, then connect Gmail from the Inbox."
    >
      <Suspense fallback={<FormCardSkeleton fields={3} />}>
        <Google searchParams={props.searchParams} />
      </Suspense>
    </SettingsSection>
  );
}

async function Google({ searchParams }: { searchParams: PageProps<"/settings/google">["searchParams"] }) {
  const [sp, saved, origin] = await Promise.all([searchParams, getMyGoogleClient(), requestOrigin()]);
  return (
    <>
      {sp.missing && !saved ? (
        <p role="alert" className="rounded-xl border bg-muted/50 px-4 py-3 text-sm">
          Set up your Google app below first. Then go back to the Inbox and connect Gmail.
        </p>
      ) : null}
      <GoogleClientCard redirectUri={gmailRedirectUri(origin)} saved={saved ? { clientId: saved.clientId, secretLast4: saved.secretLast4 } : null} />
    </>
  );
}
