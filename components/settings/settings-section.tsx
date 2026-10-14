import type { ReactNode } from "react";

/** One heading and description per settings tab, then its cards. Same on every tab. */
export function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl tracking-tight">{title}</h2>
        <p className="text-[15px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
