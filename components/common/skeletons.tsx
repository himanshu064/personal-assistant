import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders in the shape of the real content, so the page does not
 * jump when data arrives. aria-busy tells screen readers the area is loading.
 */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="overflow-hidden rounded-xl bg-card framed">
      <div className="border-b p-3">
        <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
      </div>
      <div className="hidden grid-cols-[1fr_180px_110px_40px] gap-4 border-b px-4 py-3.5 md:grid">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <span />
      </div>
      <ul className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-4 md:grid-cols-[1fr_180px_110px_40px]">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4" style={{ width: `${55 - (i % 3) * 10}%` }} />
              <Skeleton className="h-3 w-28 md:hidden" />
            </div>
            <div className="hidden flex-col gap-1.5 md:flex">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
            <Skeleton className="size-8 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col gap-5 rounded-xl bg-card p-4 framed">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-10 w-40 self-end rounded-xl" />
    </div>
  );
}

export function KeyCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl bg-card p-3 framed">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-20" />
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
