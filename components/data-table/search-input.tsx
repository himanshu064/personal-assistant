"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
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
  const urlValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(urlValue);
  // Follow the URL when it changes from outside (Clear search, back button,
  // switching tabs); otherwise the debounce below would put the old text back.
  const [lastUrlValue, setLastUrlValue] = useState(urlValue);
  if (urlValue !== lastUrlValue) {
    setLastUrlValue(urlValue);
    setValue(urlValue);
  }
  // The list keeps showing old results while new ones load; the spinner says so.
  const [searching, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      if (value === urlValue) return;
      // A new search starts again from page 1.
      const qs = withSearchParams(searchParams, { [paramName]: value || null, page: null });
      startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [value, urlValue, debounceMs, paramName, pathname, router, searchParams]);

  return (
    <div className="relative w-full sm:max-w-xs">
      {searching ? (
        <Spinner aria-label="Searching" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      ) : (
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}
