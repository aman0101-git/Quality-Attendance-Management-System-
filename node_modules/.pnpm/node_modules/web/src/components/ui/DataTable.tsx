import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./LoadingSkeleton";

export interface DataTableColumn<T> {
  /** Column heading */
  header: ReactNode;
  /** Stable key for React reconciliation */
  key: string;
  /** Render a cell for a row */
  cell: (row: T, index: number) => ReactNode;
  /** Tailwind classes applied to the column's <th> AND <td> */
  className?: string;
  /** Default text alignment */
  align?: "left" | "center" | "right";
  /** Mark column as numeric (right aligned, tabular nums) */
  numeric?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Stable row identifier; defaults to index */
  rowKey?: (row: T, index: number) => string | number;
  /** Optional row click handler. Adds hover styling. */
  onRowClick?: (row: T, index: number) => void;
  loading?: boolean;
  /** Number of skeleton rows shown while `loading` */
  loadingRows?: number;
  /** Rendered when `data` is empty and not loading */
  emptyState?: ReactNode;
  className?: string;
  /** Show subtle zebra rows */
  striped?: boolean;
  /** Sticky header inside scroll container */
  stickyHeader?: boolean;
}

/**
 * Stateless presentational table. Sorting/filtering/pagination
 * are intentionally left to consumers — this is a pure UI primitive.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  loading = false,
  loadingRows = 5,
  emptyState,
  className,
  striped = false,
  stickyHeader = false,
}: DataTableProps<T>) {
  const alignClass = (col: DataTableColumn<T>) => {
    const align = col.numeric ? "right" : col.align ?? "left";
    return align === "right"
      ? "text-right"
      : align === "center"
      ? "text-center"
      : "text-left";
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-elev-1",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead
            className={cn(
              "bg-bg-muted/60 text-xs uppercase tracking-wider text-fg-subtle",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "border-b border-border px-4 py-3 font-medium",
                    alignClass(col),
                    col.numeric && "tabular-nums",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={`s-${i}`} className="border-b border-border last:border-0">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3", alignClass(col))}
                    >
                      <Skeleton height="0.65rem" width="80%" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              data.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  className={cn(
                    "border-b border-border last:border-0 transition-colors",
                    striped && i % 2 === 1 && "bg-bg-muted/40",
                    onRowClick && "cursor-pointer hover:bg-bg-muted/70"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-3 align-middle text-fg",
                        alignClass(col),
                        col.numeric && "tabular-nums",
                        col.className
                      )}
                    >
                      {col.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && data.length === 0 && (
        <div className="p-4">
          {emptyState ?? (
            <EmptyState
              title="No data"
              description="There's nothing here yet."
            />
          )}
        </div>
      )}
    </div>
  );
}

export default DataTable;
