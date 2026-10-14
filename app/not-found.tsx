import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-sidebar px-4 py-4">
      <Link href="/" className="w-fit rounded-lg py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Logo className="text-[15px] font-normal" />
      </Link>
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl bg-card px-6 py-10 text-center framed">
          <span className="flex size-11 items-center justify-center rounded-full border bg-background">
            <CompassIcon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
          </span>
          <h1 className="text-2xl tracking-tight">This page does not exist</h1>
          <p className="text-[15px] text-muted-foreground">The link may be old or mistyped.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button size="page" nativeButton={false} render={<Link href="/home" />}>
              Go to Home
            </Button>
            <Button size="page" variant="outline" nativeButton={false} render={<Link href="/" />}>
              Back to the start
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
