import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  listAgents,
  type AgentUser,
} from "@/features/agents/api";
import {
  getGroupedProjects,
} from "@/features/projects/api";
import {
  type Project,
  type ProjectGroup,
} from "@/features/projects/types";
import {
  createAudit,
  getAudit,
  submitAudit,
  updateAudit,
} from "../api";
import {
  AuditStatus,
  type AuditDetail,
} from "../types";
import { WIZARD_STEPS, WizardSteps, type WizardStepId } from "./WizardSteps";
import LiveScorePanel from "./LiveScorePanel";
import ScoreCardFiller, {
  type AnswerDraftMap,
  type SectionRemarkMap,
} from "./ScoreCardFiller";

interface NewAuditWizardProps {
  /** When provided, the wizard resumes the given draft instead of starting fresh. */
  initialAuditId?: number;
  onCancel: () => void;
  onSubmitted: (audit: AuditDetail) => void;
  onSavedDraft?: (audit: AuditDetail) => void;
}

const fieldClass = cn(
  "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40",
);

const AUTOSAVE_DEBOUNCE_MS = 1200;

/**
 * Multi-step audit creation wizard.
 *
 * Steps: agent → group → project → call ref → scorecard fill → review/submit.
 * Drafts autosave at the API level once the audit row exists (created on
 * the call-reference step). Live score is recomputed client-side using
 * the same scoring rules as the server.
 */
export function NewAuditWizard({
  initialAuditId,
  onCancel,
  onSubmitted,
  onSavedDraft,
}: NewAuditWizardProps) {
  // Pre-step data
  const [agents, setAgents] = useState<AgentUser[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Wizard state
  const [step, setStep] = useState<WizardStepId>("agent");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [callReference, setCallReference] = useState("");

  // Server-backed audit state
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Draft answers (per-question + section remarks)
  const [answers, setAnswers] = useState<AnswerDraftMap>({});
  const [sectionRemarks, setSectionRemarks] = useState<SectionRemarkMap>({});
  const [overallComment, setOverallComment] = useState("");

  const autosaveTimer = useRef<number | null>(null);
  const dirtyRef = useRef<{
    answerIds: Set<number>;
    sectionIds: Set<number>;
    overallChanged: boolean;
  }>({ answerIds: new Set(), sectionIds: new Set(), overallChanged: false });

  // ------------------------------------------------------------
  //  Initial data loads
  // ------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      try {
        setAgentsLoading(true);
        const data = await listAgents();
        setAgents(data.filter((a) => a.isActive));
      } catch (e) {
        console.error(e);
        toast.error("Failed to load agents");
      } finally {
        setAgentsLoading(false);
      }
    })();

    void (async () => {
      try {
        setGroupsLoading(true);
        const data = await getGroupedProjects();
        setGroups(data);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load projects");
      } finally {
        setGroupsLoading(false);
      }
    })();
  }, []);

  // Load existing draft if resuming. Every audit is now created with the
  // global default QA template already attached, so there is no
  // "no template yet" branch to handle on resume.
  useEffect(() => {
    if (!initialAuditId) return;
    void (async () => {
      setBusy(true);
      try {
        const detail = await getAudit(initialAuditId);
        ingestDetail(detail);
        setStep(detail.callReference ? "scorecard" : "call");
      } catch (e) {
        console.error(e);
        toast.error("Could not resume draft");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAuditId]);

  // ------------------------------------------------------------
  //  Helpers
  // ------------------------------------------------------------

  const ingestDetail = useCallback((detail: AuditDetail) => {
    setAudit(detail);
    setAgentId(detail.agent.id);
    setGroupName(detail.groupNameSnapshot);
    setProjectId(detail.project.id);
    setCallReference(detail.callReference);
    setOverallComment(detail.overallComment ?? "");

    const nextAnswers: AnswerDraftMap = {};
    const nextRemarks: SectionRemarkMap = {};
    for (const section of detail.sections) {
      if (section.remark) nextRemarks[section.id] = section.remark;
      for (const q of section.questions) {
        nextAnswers[q.id] = {
          value: q.answer?.value ?? null,
          remark: q.answer?.remark ?? "",
        };
      }
    }
    setAnswers(nextAnswers);
    setSectionRemarks(nextRemarks);
  }, []);

  // ------------------------------------------------------------
  //  Step navigation gating
  // ------------------------------------------------------------

  const canAdvanceFrom = (s: WizardStepId): boolean => {
    switch (s) {
      case "agent":
        return Boolean(agentId);
      case "group":
        return Boolean(groupName);
      case "project":
        return Boolean(projectId);
      case "call":
        return callReference.trim().length >= 2;
      case "scorecard":
        return Boolean(audit && audit.sections.length);
      case "review":
        return true;
    }
  };

  const reachable: WizardStepId[] = useMemo(() => {
    const out: WizardStepId[] = ["agent"];
    if (agentId) out.push("group");
    if (groupName) out.push("project");
    if (projectId) out.push("call");
    if (audit) out.push("scorecard");
    if (audit && audit.sections.length) out.push("review");
    return out;
  }, [agentId, groupName, projectId, audit]);

  const goNext = useCallback(async () => {
    if (!canAdvanceFrom(step)) return;
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);

    // Side-effects: if leaving "call" without an audit yet, create one.
    // The backend auto-attaches the global default QA template, so the
    // returned `created` audit already has its sections + questions.
    if (step === "call" && !audit) {
      if (!agentId || !projectId) return;
      setBusy(true);
      try {
        const created = await createAudit({
          agentId,
          projectId,
          callReference: callReference.trim(),
        });
        ingestDetail(created);
        toast.success(`Draft ${created.auditCode} saved`);
        onSavedDraft?.(created);
      } catch (e) {
        const err = e as AxiosError<{ message?: string | string[] }>;
        const raw = err.response?.data?.message;
        const msg = Array.isArray(raw) ? raw.join(", ") : raw;
        toast.error(msg ?? "Could not create audit");
        setBusy(false);
        return;
      }
      setBusy(false);
    }

    if (idx < WIZARD_STEPS.length - 1) {
      setStep(WIZARD_STEPS[idx + 1].id);
    }
  }, [
    step,
    audit,
    agentId,
    projectId,
    callReference,
    ingestDetail,
    onSavedDraft,
  ]);

  const goPrev = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStep(WIZARD_STEPS[idx - 1].id);
  };

  const jump = (target: WizardStepId) => {
    if (reachable.includes(target)) setStep(target);
  };

  // ------------------------------------------------------------
  //  Autosave
  // ------------------------------------------------------------

  const flushAutosave = useCallback(async () => {
    if (!audit) return;
    const dirty = dirtyRef.current;
    if (
      dirty.answerIds.size === 0 &&
      dirty.sectionIds.size === 0 &&
      !dirty.overallChanged
    ) {
      return;
    }

    const payload = {
      ...(dirty.answerIds.size
        ? {
            answers: [...dirty.answerIds].map((qid) => ({
              questionId: qid,
              value: answers[qid]?.value ?? null,
              remark: answers[qid]?.remark ?? null,
            })),
          }
        : {}),
      ...(dirty.sectionIds.size
        ? {
            sectionRemarks: [...dirty.sectionIds].map((sid) => ({
              sectionId: sid,
              remark: sectionRemarks[sid] ?? null,
            })),
          }
        : {}),
      ...(dirty.overallChanged ? { overallComment } : {}),
    };

    setSaving(true);
    try {
      const updated = await updateAudit(audit.id, payload);
      setAudit(updated);
      // Refresh the live-score-driving derived fields from the server
      // (sectionScore, totalScore, finalScore).
      dirty.answerIds.clear();
      dirty.sectionIds.clear();
      dirty.overallChanged = false;
    } catch (e) {
      console.error(e);
      toast.error("Autosave failed");
    } finally {
      setSaving(false);
    }
  }, [audit, answers, sectionRemarks, overallComment]);

  const scheduleAutosave = useCallback(() => {
    if (!audit) return;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = window.setTimeout(() => {
      void flushAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [audit, flushAutosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  const onAnswer = useCallback(
    (questionId: number, value: string | null) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...(prev[questionId] ?? {}), value, remark: prev[questionId]?.remark ?? "" },
      }));
      dirtyRef.current.answerIds.add(questionId);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onAnswerRemark = useCallback(
    (questionId: number, remark: string) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          value: prev[questionId]?.value ?? null,
          remark,
        },
      }));
      dirtyRef.current.answerIds.add(questionId);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onSectionRemark = useCallback(
    (sectionId: number, remark: string) => {
      setSectionRemarks((prev) => ({ ...prev, [sectionId]: remark }));
      dirtyRef.current.sectionIds.add(sectionId);
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onOverallComment = useCallback(
    (next: string) => {
      setOverallComment(next);
      dirtyRef.current.overallChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // ------------------------------------------------------------
  //  Submit
  // ------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (!audit) return;
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
    }
    await flushAutosave();
    setSubmitting(true);
    try {
      const finalAudit = await submitAudit(audit.id, {
        overallComment,
      });
      toast.success(`Audit ${finalAudit.auditCode} submitted`);
      onSubmitted(finalAudit);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not submit audit");
    } finally {
      setSubmitting(false);
    }
  }, [audit, flushAutosave, overallComment, onSubmitted]);

  // ------------------------------------------------------------
  //  Render
  // ------------------------------------------------------------

  const selectedAgent = agents.find((a) => a.id === agentId) ?? null;
  const selectedProject: Project | null = useMemo(() => {
    if (!projectId) return null;
    for (const g of groups) {
      const found = g.projects.find((p) => p.id === projectId);
      if (found) return found;
    }
    return null;
  }, [groups, projectId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5"
    >
      {/* Header */}
      <AppCard padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              {audit ? `Editing ${audit.auditCode}` : "New audit"}
            </p>
            <p className="text-base font-semibold text-fg">
              {WIZARD_STEPS.find((s) => s.id === step)?.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </span>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>
        <div className="mt-3">
          <WizardSteps current={step} reachable={reachable} onJump={jump} />
        </div>
      </AppCard>

      {/* Body */}
      {step === "agent" && (
        <StepShell title="Select agent">
          {agentsLoading ? (
            <p className="text-sm text-fg-subtle">Loading agents…</p>
          ) : agents.length === 0 ? (
            <EmptyState
              title="No active agents"
              description="Add an agent in the Agents page first."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgentId(a.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border bg-bg-elevated p-3 text-left transition-colors",
                    agentId === a.id
                      ? "border-accent/40 ring-1 ring-accent/30"
                      : "border-border hover:bg-bg-muted",
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{a.name}</p>
                    <p className="truncate text-xs text-fg-subtle">@{a.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </StepShell>
      )}

      {step === "group" && (
        <StepShell title="Select group">
          {groupsLoading ? (
            <p className="text-sm text-fg-subtle">Loading groups…</p>
          ) : groups.length === 0 ? (
            <EmptyState title="No groups available" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <button
                  key={g.groupName}
                  type="button"
                  onClick={() => {
                    setGroupName(g.groupName);
                    if (
                      projectId &&
                      !g.projects.some((p) => p.id === projectId)
                    ) {
                      setProjectId(null);
                    }
                  }}
                  className={cn(
                    "flex flex-col gap-1 rounded-md border bg-bg-elevated p-3 text-left transition-colors",
                    groupName === g.groupName
                      ? "border-accent/40 ring-1 ring-accent/30"
                      : "border-border hover:bg-bg-muted",
                  )}
                >
                  <p className="text-sm font-semibold text-fg">{g.groupName}</p>
                  <p className="text-xs text-fg-subtle">
                    {g.count} project{g.count === 1 ? "" : "s"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </StepShell>
      )}

      {step === "project" && (
        <StepShell title={`Projects in ${groupName ?? ""}`}>
          {(() => {
            const group = groups.find((g) => g.groupName === groupName);
            const list = group?.projects.filter((p) => p.status === "ACTIVE") ?? [];
            if (list.length === 0) {
              return (
                <EmptyState
                  title="No active projects"
                  description="Pick a different group or activate a project."
                />
              );
            }
            return (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProjectId(p.id)}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border bg-bg-elevated p-3 text-left transition-colors",
                      projectId === p.id
                        ? "border-accent/40 ring-1 ring-accent/30"
                        : "border-border hover:bg-bg-muted",
                    )}
                  >
                    <p className="text-sm font-semibold text-fg">{p.projectName}</p>
                    {p.description && (
                      <p className="line-clamp-2 text-xs text-fg-subtle">
                        {p.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            );
          })()}
        </StepShell>
      )}

      {step === "call" && (
        <StepShell title="Call reference">
          <div className="max-w-md">
            <label className="text-xs font-medium text-fg-muted">
              Call reference / recording id
            </label>
            <input
              value={callReference}
              onChange={(e) => setCallReference(e.target.value)}
              placeholder="e.g. CALL-2026-04-30-72931"
              className={cn(fieldClass, "mt-1.5")}
              autoFocus
            />
            <p className="mt-2 text-xs text-fg-subtle">
              Used to bind this audit to the source call. Must be unique per agent.
            </p>
          </div>
        </StepShell>
      )}

      {step === "scorecard" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            {!audit || !audit.sections.length ? (
              <AppCard padding="sm">
                <p className="text-sm text-fg-muted">
                  Loading the default QA template…
                </p>
              </AppCard>
            ) : (
              <ScoreCardFiller
                sections={audit.sections}
                answers={answers}
                sectionRemarks={sectionRemarks}
                onAnswer={onAnswer}
                onAnswerRemark={onAnswerRemark}
                onSectionRemark={onSectionRemark}
              />
            )}
          </div>

          {audit && audit.sections.length > 0 && (
            <LiveScorePanel audit={audit} answers={answers} />
          )}
        </div>
      )}

      {step === "review" && audit && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <StepShell title="Review">
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <ReviewItem label="Agent" value={selectedAgent?.name ?? "—"} />
                <ReviewItem label="Group" value={audit.groupNameSnapshot} />
                <ReviewItem
                  label="Project"
                  value={selectedProject?.projectName ?? audit.projectNameSnapshot}
                />
                <ReviewItem label="Call reference" value={audit.callReference} />
                <ReviewItem
                  label="Status"
                  value={audit.status === AuditStatus.SUBMITTED ? "Submitted" : "In progress"}
                />
                <ReviewItem
                  label="Audit code"
                  value={audit.auditCode}
                />
              </dl>
            </StepShell>

            <StepShell title="Overall comment">
              <textarea
                rows={5}
                value={overallComment}
                onChange={(e) => onOverallComment(e.target.value)}
                placeholder="Summarize the audit outcome and feedback for the agent…"
                className={cn(
                  fieldClass,
                  "h-auto resize-none py-2 leading-relaxed",
                )}
              />
            </StepShell>
          </div>

          <LiveScorePanel audit={audit} answers={answers} />
        </div>
      )}

      {/* Footer */}
      <AppCard padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-fg-subtle">
            {audit
              ? "Drafts autosave automatically while you work."
              : "A draft will be saved when you continue past the call reference."}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === "agent"}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {step === "scorecard" && audit?.sections.length ? (
              <button
                type="button"
                onClick={() => void flushAutosave()}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                <Save className="h-4 w-4" />
                Save now
              </button>
            ) : null}

            {step === "review" ? (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || busy}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
                  "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
                )}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                Submit audit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void goNext()}
                disabled={!canAdvanceFrom(step) || busy}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
                  "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-50",
                )}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Continue
              </button>
            )}
          </div>
        </div>
      </AppCard>
    </motion.div>
  );
}

function StepShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AppCard padding="md">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {title}
      </p>
      {children}
    </AppCard>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-fg">{value}</dd>
    </div>
  );
}

export default NewAuditWizard;
