import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Empty list or panel: what is missing, and the one thing to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full border bg-background">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="mt-1 text-[15px]">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
