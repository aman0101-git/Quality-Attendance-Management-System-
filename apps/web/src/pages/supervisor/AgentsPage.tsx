import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, UserPlus, Users } from "lucide-react";
import PageContainer from "@/layouts/PageContainer";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import { listAgents, type AgentUser } from "@/features/agents/api";
import AddUserDialog from "@/features/users/components/AddUserDialog";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

const columns: DataTableColumn<AgentUser>[] = [
  {
    key: "name",
    header: "Agent",
    cell: (agent) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{agent.name}</p>
          <p className="truncate text-xs text-fg-subtle">@{agent.username}</p>
        </div>
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    cell: (agent) => (
      <span className="text-xs uppercase tracking-wider text-fg-muted">
        {agent.role}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (agent) => (
      <StatusBadge tone={agent.isActive ? "success" : "neutral"}>
        {agent.isActive ? "Active" : "Inactive"}
      </StatusBadge>
    ),
  },
  {
    key: "createdAt",
    header: "Joined",
    align: "right",
    cell: (agent) => (
      <span className="text-xs text-fg-subtle">
        {formatDate(agent.createdAt)}
      </span>
    ),
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAgents();
      setAgents(data);
    } catch (err) {
      console.error(err);
      setError("Could not load agents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((a) => {
      return (
        a.name.toLowerCase().includes(term) ||
        a.username.toLowerCase().includes(term)
      );
    });
  }, [agents, search]);

  const activeCount = useMemo(
    () => agents.filter((a) => a.isActive).length,
    [agents],
  );

  return (
    <PageContainer
      maxWidth="xl"
      title="Agents"
      description="Manage your team — every agent here can be assigned to calls and audits."
      actions={
        <>
          <button
            onClick={() => void fetchAgents()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Add agent
          </button>
        </>
      }
    >
      <AppCard padding="sm" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-sm">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search by name or username…"
            />
          </div>
          <p className="text-xs text-fg-subtle">
            {loading
              ? "Loading…"
              : `${activeCount} active · ${agents.length} total`}
          </p>
        </div>
      </AppCard>

      {error ? (
        <EmptyState
          icon={Users}
          title="Couldn't load agents"
          description={error}
          action={
            <button
              onClick={() => void fetchAgents()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
            >
              Try again
            </button>
          }
        />
      ) : (
        <DataTable<AgentUser>
          columns={columns}
          data={filtered}
          rowKey={(agent) => agent.id}
          loading={loading}
          loadingRows={5}
          emptyState={
            <EmptyState
              icon={Users}
              title={search ? "No matching agents" : "No agents yet"}
              description={
                search
                  ? "Try a different search term."
                  : "Add your first agent to get started."
              }
              action={
                !search ? (
                  <button
                    onClick={() => setAddOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg shadow-elev-1 hover:opacity-90"
                  >
                    <UserPlus className="h-4 w-4" /> Add agent
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        actorRole="SUPERVISOR"
        onCreated={() => void fetchAgents()}
      />
    </PageContainer>
  );
}
