import Image from "next/image";
import { cn } from "cn";
import { LOGO_PATH, SITE_NAME } from "@/lib/constants/site";

/** Brand mark plus name. Both come from `lib/constants/site.ts`. */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", className)}>
      <Image src={LOGO_PATH} alt={showName ? "" : SITE_NAME} width={28} height={28} className="size-7 rounded-lg" priority />
      {showName ? <span className="truncate">{SITE_NAME}</span> : null}
    </span>
  );
}
