"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { withSearchParams } from "@/lib/url";

/** Search box that writes `?q=` to the URL after the user stops typing. */
export function SearchInput({
  paramName = "q",
  placeholder = "Search",
  debounceMs = 300,
}: {
  paramName?: string;
  placeholder?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchParams.get(paramName) ?? "";
      if (value === current) return;
      // A new search starts again from page 1.
      const qs = withSearchParams(searchParams, { [paramName]: value || null, page: null });
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [value, debounceMs, paramName, pathname, router, searchParams]);

  return (
    <div className="relative w-full md:max-w-sm">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 pl-9 md:h-8"
      />
    </div>
  );
}
