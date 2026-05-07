import { ArrowUpRight } from "lucide-react";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ActivityRow } from "../mock";

interface RecentActivityCardProps {
  rows: ActivityRow[];
  loading?: boolean;
}

const columns: DataTableColumn<ActivityRow>[] = [
  {
    key: "actor",
    header: "Actor",
    cell: (row) => (
      <span className="font-medium text-fg">{row.actor}</span>
    ),
  },
  {
    key: "action",
    header: "Action",
    cell: (row) => (
      <span className="text-fg-muted">
        {row.action} <span className="text-fg">{row.target}</span>
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <StatusBadge tone={row.status.tone}>{row.status.label}</StatusBadge>
    ),
  },
  {
    key: "timestamp",
    header: "When",
    align: "right",
    cell: (row) => (
      <span className="text-xs text-fg-subtle">{row.timestamp}</span>
    ),
  },
];

export function RecentActivityCard({
  rows,
  loading = false,
}: RecentActivityCardProps) {
  return (
    <AppCard
      padding="none"
      header={
        <>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-fg">
              Recent activity
            </h3>
            <p className="text-xs text-fg-subtle">
              Latest events from your workspace
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </>
      }
    >
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingRows={4}
        rowKey={(r) => r.id}
        className="border-0 shadow-none rounded-none"
      />
    </AppCard>
  );
}

export default RecentActivityCard;
