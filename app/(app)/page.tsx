import { Suspense } from "react";
import { MicIcon } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";
import { PageContainer } from "@/components/app-shell/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";

export default function HomePage() {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <Greeting />
      </Suspense>
      <ComingSoon
        icon={MicIcon}
        title="Voice reminders are on the way"
        description="Soon you will tap the mic, say what to remember, and check it before saving."
      />
    </PageContainer>
  );
}

async function Greeting() {
  const user = await requireUser();
  const firstName = user.name.split(/\s+/)[0];
  return <h1 className="text-2xl font-semibold tracking-tight">Hi, {firstName}</h1>;
}
