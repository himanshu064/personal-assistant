export const DEFAULT_PAGE_SIZE = 10;
export const ALLOWED_PAGE_SIZES = [10, 20, 25, 50, 100] as const;

/** Reads `?page=` and `?per_page=` safely, falling back to the defaults. */
export function parsePaging(params: { page?: string | string[]; per_page?: string | string[] }) {
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);
  const requested = Number.parseInt(String(params.per_page ?? DEFAULT_PAGE_SIZE), 10);
  const pageSize = (ALLOWED_PAGE_SIZES as readonly number[]).includes(requested) ? requested : DEFAULT_PAGE_SIZE;
  return { page, pageSize, offset: (page - 1) * pageSize };
}
