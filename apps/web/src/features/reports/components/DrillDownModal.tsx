import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, ShieldAlert, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import AuditStatusBadge from "@/features/audits/components/AuditStatusBadge";
import {
  cn,
  formatAuditScore,
  formatDateTime,
  qualityLabel,
  type QualityLabel,
} from "@/lib/utils";
import { type AuditListItem } from "@/features/audits/types";

/**
 * Tone classes used across the drill-down rows. Kept local to the
 * module so the file is self-contained and easy to audit.
 */
const QUALITY_TONE: Record<NonNullable<QualityLabel>, string> = {
  GOOD: "border-success/40 bg-success/15 text-success",
  AVERAGE: "border-warning/40 bg-warning/15 text-warning",
  BAD: "border-danger/40 bg-danger/15 text-danger",
};

/**
 * Lightweight aggregated agent row shown in the agent variant of the
 * drill-down. Computed by the report view from the same audit list
 * the rest of the page uses, so it always reflects whatever the
 * supervisor / admin already has access to — no separate API.
 */
export interface DrillDownAgentRow {
  agentId: string;
  name: string;
  username: string;
  totalAudits: number;
  scoredAudits: number;
  averageScore: number | null;
  fatalCount: number;
}

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional descriptive subtitle. */
  description?: string;
}

interface AuditVariant extends BaseProps {
  variant: "audits";
  audits: AuditListItem[];
  /**
   * Optional row click handler. When provided, the modal closes on
   * click. Otherwise rows still open the appropriate detail page —
   * defaulting via `useNavigate` to /supervisor/audits or
   * /agent/audits/:id depending on caller intent (set via `openHref`).
   */
  onAuditClick?: (audit: AuditListItem) => void;
}

interface AgentVariant extends BaseProps {
  variant: "agents";
  agents: DrillDownAgentRow[];
  onAgentClick?: (agent: DrillDownAgentRow) => void;
}

type DrillDownModalProps = AuditVariant | AgentVariant;

const PAGE_SIZE = 20;

/**
 * Reusable drill-down modal for reports / dashboards.
 *
 * KPI cards across the supervisor + admin views pass the operationally
 * relevant slice of audits (or aggregated agents) into this component
 * so users can click a number and immediately see which records back
 * it.  Role-based filtering is enforced by the *caller* — this modal
 * is pure presentation; it never re-fetches.  That keeps the
 * permission boundary identical to the rest of the app: supervisors
 * see their scoped audits, admins see workspace-wide data.
 */
export function DrillDownModal(props: DrillDownModalProps) {
  const { open, onOpenChange, title, description } = props;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  // Reset paging + search when the modal opens with a different metric
  // — otherwise re-opening the same modal would inherit the last
  // session's term, which is rarely what the user wants.
  // Keying off `title + variant + count` is enough for our usage
  // (each metric has a distinct title).
  const resetKey = useMemo(() => {
    if (props.variant === "audits") return `${title}::${props.audits.length}`;
    return `${title}::${props.agents.length}`;
  }, [title, props]);

  // useMemo guards against re-running effects on every render — when
  // the resetKey changes, paging and search are cleared.
  useMemo(() => {
    setPage(1);
    setSearch("");
    return resetKey;
  }, [resetKey]);

  if (props.variant === "audits") {
    const filtered = filterAudits(props.audits, search);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={
          description ??
          `${filtered.length} of ${props.audits.length} audit${
            props.audits.length === 1 ? "" : "s"
          }`
        }
        size="xl"
      >
        <DrillDownToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by code, agent, project…"
          right={
            totalPages > 1 ? (
              <Pager page={page} totalPages={totalPages} onPage={setPage} />
            ) : null
          }
        />

        <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md border border-border">
          {filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No matching audits"
              description={
                search
                  ? "Try a different search term."
                  : "No audits back this metric in the selected range."
              }
              className="border-none bg-transparent"
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-wider text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Audit</th>
                  <th className="px-3 py-2 text-left font-medium">Agent</th>
                  <th className="px-3 py-2 text-left font-medium">Project</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-left font-medium">Quality</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.map((a) => {
                  const q = qualityLabel(a.finalScore, a.fatalTriggered);
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer hover:bg-bg-muted/40"
                      onClick={() => {
                        if (props.onAuditClick) {
                          props.onAuditClick(a);
                        } else {
                          // Default: take the supervisor straight into
                          // the audit's editor / view.
                          navigate(`/supervisor/audits?open=${a.id}`);
                        }
                        onOpenChange(false);
                      }}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-fg">
                            {a.auditCode}
                          </span>
                          <span className="text-[11px] text-fg-subtle">
                            {a.callReference}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-fg">
                            {a.agent.name}
                          </p>
                          <p className="truncate text-[11px] text-fg-subtle">
                            @{a.agent.username}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-fg">
                            {a.projectNameSnapshot}
                          </p>
                          <p className="truncate text-[11px] text-fg-subtle">
                            {a.groupNameSnapshot}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            a.fatalTriggered ? "text-danger" : "text-fg",
                          )}
                        >
                          {formatAuditScore(
                            a.finalScore,
                            a.totalScore,
                            a.applicablePoints,
                          )}
                        </span>
                        {a.fatalTriggered && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-danger">
                            <ShieldAlert className="h-3 w-3" />
                            Fatal
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {q ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                              QUALITY_TONE[q],
                            )}
                          >
                            {q}
                          </span>
                        ) : (
                          <span className="text-[11px] text-fg-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <AuditStatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-fg-subtle">
                        {formatDateTime(a.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    );
  }

  // --- agents variant ---------------------------------------------------
  const filteredAgents = filterAgents(props.agents, search);
  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const pageRows = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        description ??
        `${filteredAgents.length} of ${props.agents.length} agent${
          props.agents.length === 1 ? "" : "s"
        }`
      }
      size="xl"
    >
      <DrillDownToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search by name or @username…"
        right={
          totalPages > 1 ? (
            <Pager page={page} totalPages={totalPages} onPage={setPage} />
          ) : null
        }
      />

      <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-md border border-border">
        {filteredAgents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No matching agents"
            description={
              search
                ? "Try a different search term."
                : "No agents back this metric in the selected range."
            }
            className="border-none bg-transparent"
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase tracking-wider text-fg-subtle">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Agent</th>
                <th className="px-3 py-2 text-right font-medium">Audits</th>
                <th className="px-3 py-2 text-right font-medium">Avg score</th>
                <th className="px-3 py-2 text-left font-medium">Tier</th>
                <th className="px-3 py-2 text-right font-medium">Fatal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((row) => (
                <tr
                  key={row.agentId}
                  className="cursor-pointer hover:bg-bg-muted/40"
                  onClick={() => {
                    if (props.onAgentClick) {
                      props.onAgentClick(row);
                    }
                    onOpenChange(false);
                  }}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {row.name}
                        </p>
                        <p className="truncate text-[11px] text-fg-subtle">
                          @{row.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm text-fg">
                    {row.totalAudits}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-sm font-semibold text-fg">
                    {row.averageScore === null
                      ? "—"
                      : `${row.averageScore.toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2">
                    <PerformanceTier averageScore={row.averageScore} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span
                      className={cn(
                        "text-sm",
                        row.fatalCount > 0 ? "text-danger" : "text-fg-muted",
                      )}
                    >
                      {row.fatalCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

function filterAudits(rows: AuditListItem[], search: string): AuditListItem[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((a) => {
    return (
      a.auditCode.toLowerCase().includes(term) ||
      a.callReference.toLowerCase().includes(term) ||
      a.agent.name.toLowerCase().includes(term) ||
      a.agent.username.toLowerCase().includes(term) ||
      a.projectNameSnapshot.toLowerCase().includes(term) ||
      a.groupNameSnapshot.toLowerCase().includes(term)
    );
  });
}

function filterAgents(
  rows: DrillDownAgentRow[],
  search: string,
): DrillDownAgentRow[] {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(term) ||
      r.username.toLowerCase().includes(term),
  );
}

function DrillDownToolbar({
  search,
  onSearch,
  placeholder,
  right,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full max-w-xs">
        <SearchInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onClear={() => onSearch("")}
          placeholder={placeholder}
        />
      </div>
      {right}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 text-xs text-fg-muted">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="inline-flex h-7 items-center rounded-md border border-border bg-bg-elevated px-2 text-xs font-medium text-fg-muted hover:bg-bg-muted disabled:opacity-50"
      >
        Prev
      </button>
      <span className="px-2 tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="inline-flex h-7 items-center rounded-md border border-border bg-bg-elevated px-2 text-xs font-medium text-fg-muted hover:bg-bg-muted disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}

/**
 * Small tier badge — green for Top Performer, danger for Need Attention,
 * neutral when there's no scored audit yet. Used inside the agent
 * drill-down rows so the supervisor can see the classification inline.
 */
function PerformanceTier({ averageScore }: { averageScore: number | null }) {
  if (averageScore === null) {
    return <StatusBadge tone="neutral">—</StatusBadge>;
  }
  if (averageScore >= 85) {
    return <StatusBadge tone="success">Top performer</StatusBadge>;
  }
  return <StatusBadge tone="danger">Needs attention</StatusBadge>;
}

export default DrillDownModal;
