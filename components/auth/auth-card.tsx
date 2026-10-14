import type { ReactNode } from "react";

/** Heading, form and footer for the auth screens. No card frame: the page itself is the surface. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-3xl tracking-tight">{title}</h1>
        {description ? <p className="text-[15px] text-muted-foreground">{description}</p> : null}
      </div>
      {children}
      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
