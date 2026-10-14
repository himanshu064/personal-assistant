"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  columnSizingFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Row,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE } from "@/lib/constants/table";
import { withSearchParams } from "@/lib/url";
import { Pagination } from "./pagination";
import { SearchInput } from "./search-input";

/**
 * The table features every DataTable registers. Columns must be typed against
 * them, so build columns with `dataTableColumns<T>()` below.
 */
export const dataTableFeatures = tableFeatures({ columnSizingFeature, rowSelectionFeature });

type Features = typeof dataTableFeatures;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumn<TData extends RowData> = ColumnDef<Features, TData, any>;

/** Typed column helper: `const col = dataTableColumns<Reminder>()`. */
export function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<Features, TData>();
}

type DataTableProps<TData extends RowData> = {
  /** Keep this stable (module scope or useMemo), or the table rebuilds every render. */
  columns: DataTableColumn<TData>[];
  data: TData[];
  /** Stable id per row, used for selection. */
  getRowId: (row: TData) => string;
  /** Server side paging. Omit all three for a short list with no pagination. */
  totalCount?: number;
  currentPage?: number;
  pageSize?: number;
  /** Search box placeholder. Pass null to hide the search box. */
  searchPlaceholder?: string | null;
  /** Extra filter controls shown next to the search box. */
  filters?: ReactNode;
  /** Column ids kept visible on the left while scrolling sideways. */
  stickyColumns?: string[];
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  /** Shown when there are no rows: a string, or a full EmptyState. */
  emptyMessage?: ReactNode;
  /**
   * Phones: render each row as a card instead of a table row. Wide tables
   * are hard to use on a small screen, so pass this for user facing lists.
   */
  renderMobileRow?: (row: Row<Features, TData>) => ReactNode;
};

/**
 * Common table. Search (`?q=`), page (`?page=`) and page size (`?per_page=`)
 * live in the URL, so the server component reads them and fetches only one
 * page from the database.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  totalCount,
  currentPage = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  searchPlaceholder = "Search",
  filters,
  stickyColumns = ["select", "actions"],
  enableRowSelection = false,
  onSelectionChange,
  emptyMessage = "Nothing here yet.",
  renderMobileRow,
}: DataTableProps<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [changingSize, startTransition] = useTransition();

  const allColumns = useMemo<DataTableColumn<TData>[]>(() => {
    if (!enableRowSelection) return columns;
    const select: DataTableColumn<TData> = {
      id: "select",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
          aria-label="Select row"
        />
      ),
    };
    return [select, ...columns];
  }, [columns, enableRowSelection]);

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data,
    getRowId,
    enableRowSelection,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(next);
      onSelectionChange?.(data.filter((row) => next[getRowId(row)]));
    },
  });

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();
  const sticky = new Set(stickyColumns);
  const selectedCount = Object.keys(rowSelection).length;
  // The pager only appears when there is more than the smallest page size to show.
  const paged = totalCount !== undefined && totalCount > ALLOWED_PAGE_SIZES[0];

  /** Left offset for a sticky column: the widths of sticky columns before it. */
  function stickyLeft(columnId: string): number {
    let left = 0;
    for (const header of headerGroups[0]?.headers ?? []) {
      if (header.id === columnId) break;
      if (sticky.has(header.id)) left += header.getSize();
    }
    return left;
  }

  function changePageSize(value: unknown) {
    if (!value) return;
    const qs = withSearchParams(searchParams, {
      per_page: String(value) === String(DEFAULT_PAGE_SIZE) ? null : String(value),
      page: null,
    });
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const footer = paged ? (
    <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={changePageSize}>
          <SelectTrigger className="h-8 w-[72px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALLOWED_PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCount > 0 ? <span className="text-xs text-muted-foreground">{selectedCount} selected</span> : null}
      </div>
      <Pagination currentPage={currentPage} pageSize={pageSize} totalCount={totalCount ?? 0} />
    </div>
  ) : null;

  return (
    // One bordered container: toolbar, rows, then the pager, as on a dashboard table.
    <div className="overflow-hidden rounded-xl bg-card framed">
      {searchPlaceholder !== null || filters ? (
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          {searchPlaceholder !== null ? <SearchInput placeholder={searchPlaceholder} /> : null}
          {filters ? <div className="flex items-center gap-2 sm:ml-auto">{filters}</div> : null}
        </div>
      ) : null}

      {renderMobileRow ? (
        <ul className="flex flex-col divide-y md:hidden">
          {rows.length === 0 ? (
            <li className={cn("text-center text-sm text-muted-foreground", typeof emptyMessage === "string" && "py-12")}>{emptyMessage}</li>
          ) : (
            rows.map((row) => <li key={row.id}>{renderMobileRow(row)}</li>)
          )}
        </ul>
      ) : null}

      <div
        aria-busy={changingSize}
        className={cn("overflow-x-auto transition-opacity", renderMobileRow && "hidden md:block", changingSize && "opacity-60")}
      >
        <Table>
          <TableHeader>
            {headerGroups.map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const isSticky = sticky.has(header.id);
                  return (
                    <TableHead
                      key={header.id}
                      className={cn("h-11 px-4 text-[13px] font-normal text-muted-foreground", isSticky && "sticky z-20 bg-muted shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]")}
                      style={{
                        // 150 is TanStack's default size; only set widths that were asked for.
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                        ...(isSticky ? { left: stickyLeft(header.id) } : {}),
                      }}
                    >
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={allColumns.length}
                  className={cn("text-center text-sm whitespace-normal text-muted-foreground", typeof emptyMessage === "string" ? "py-12" : "p-0")}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getAllCells().map((cell) => {
                    const isSticky = sticky.has(cell.column.id);
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn("px-4 py-3 text-[15px]", isSticky && "sticky z-20 bg-background shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]")}
                        style={isSticky ? { left: stickyLeft(cell.column.id) } : undefined}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {footer}
    </div>
  );
}
