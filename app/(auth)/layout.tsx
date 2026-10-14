import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SITE_TAGLINE } from "@/lib/constants/site";

/**
 * Same look as the app: the warm grey canvas with the form on one framed
 * white panel (reference shots in ui-references/).
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col bg-sidebar px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between py-2">
        <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo className="text-[15px] font-normal" />
        </Link>
        <Link href="/" className="text-[15px] text-muted-foreground hover:text-foreground">
          Back to home
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[420px] rounded-2xl bg-card p-6 framed sm:p-8">{children}</div>
      </main>
      <footer className="pb-2 text-center text-sm text-muted-foreground">{SITE_TAGLINE}</footer>
    </div>
  );
}
