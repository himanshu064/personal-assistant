import { Suspense } from "react";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { BottomTabBar } from "@/components/app-shell/bottom-tab-bar";
import { TimezoneSync } from "@/components/app-shell/timezone-sync";
import { UserMenu } from "@/components/app-shell/user-menu";
import { Logo } from "@/components/brand/logo";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";

/**
 * The shell (sidebar, tab bar, header) is static and prerendered. Only the
 * user menu reads the session, so it streams in behind its own Suspense
 * boundary and never blocks the page.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        userMenu={
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <SessionUserMenu />
          </Suspense>
        }
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger className="hidden md:inline-flex" />
          <Logo className="md:hidden" />
          <div className="md:hidden">
            <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
              <SessionUserMenu compact />
            </Suspense>
          </div>
        </header>
        {/* Bottom padding keeps content clear of the phone tab bar. */}
        <div className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      </SidebarInset>
      <BottomTabBar />
      <TimezoneSync />
    </SidebarProvider>
  );
}

async function SessionUserMenu({ compact }: { compact?: boolean }) {
  const user = await requireUser();
  return <UserMenu user={user} compact={compact} />;
}
