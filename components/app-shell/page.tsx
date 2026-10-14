import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

type Crumb = { label: string; href?: string };

/**
 * Every app screen uses this (layout from the reference shots in
 * ui-references/): a small grey breadcrumb, a large regular weight title,
 * actions on the title row, optional underline tabs, then the content.
 * Full width and left aligned.
 */
export function Page({
  title,
  description,
  breadcrumb,
  actions,
  tabs,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** Defaults to the title alone, as in the reference. */
  breadcrumb?: Crumb[];
  actions?: ReactNode;
  /** Usually <PageTabs>. Sits under the title with a hairline below. */
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const crumbs = breadcrumb ?? [{ label: title }];
  return (
    <main className={cn("flex flex-1 flex-col gap-6 px-4 pt-5 pb-8 md:px-6 md:pt-6 lg:px-7", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5 text-[15px] text-muted-foreground">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  {i > 0 ? <span aria-hidden>/</span> : null}
                  {c.href ? (
                    <Link href={c.href} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-4xl leading-tight tracking-[-0.03em] md:text-5xl">{title}</h1>
              {description ? <p className="text-[15px] text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2 pb-1">{actions}</div> : null}
          </div>
        </div>
        {tabs}
      </div>
      {children}
    </main>
  );
}
