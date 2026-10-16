import { Suspense } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AssistantFab, AssistantProvider } from "@/components/assistant/assistant-button";
import { BottomTabBar } from "@/components/app-shell/bottom-tab-bar";
import { ServiceWorkerRegistrar } from "@/components/app-shell/service-worker-registrar";
import { TimezoneSync } from "@/components/app-shell/timezone-sync";
import { UserMenu } from "@/components/app-shell/user-menu";
import { SiteHeader } from "@/components/app-shell/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";

/**
 * Inset dashboard shell: sidebar on a grey background, pages on a white
 * panel with a top bar. The shell is static and prerendered; only the user
 * menu reads the session, behind its own Suspense boundary.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AssistantProvider>
        <AppSidebar
          account={
            <Suspense fallback={<Skeleton className="h-12 w-full rounded-xl" />}>
              <SessionUserMenu />
            </Suspense>
          }
        />
        {/* The white page panel, floating on the warm grey canvas. */}
        <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:m-3 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-[0_0_0_1px_var(--border),0_1px_3px_rgb(0_0_0/0.04)]">
          <SiteHeader
            userMenu={
              <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
                <SessionUserMenu compact />
              </Suspense>
            }
          />
          {/* Bottom padding keeps content clear of the phone tab bar. */}
          <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">{children}</div>
        </SidebarInset>
        <BottomTabBar />
        <AssistantFab />
        <ServiceWorkerRegistrar />
      </AssistantProvider>
    </SidebarProvider>
  );
}

async function SessionUserMenu({ compact }: { compact?: boolean }) {
  const user = await requireUser();
  return (
    <>
      <UserMenu user={user} compact={compact} />
      {/* Mounted once, from the header copy: the header is always mounted (on
          desktop it is only hidden with CSS), while the phone sidebar is not. */}
      {compact ? <TimezoneSync userId={user.id} /> : null}
    </>
  );
}
