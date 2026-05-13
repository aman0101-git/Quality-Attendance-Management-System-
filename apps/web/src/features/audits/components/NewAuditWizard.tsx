import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Loader2,
  Lock,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
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
  discardAudit,
  getAudit,
  publishAudit,
  setCorrectionNote,
  submitAudit,
  updateAudit,
} from "../api";
import {
  AUDIT_IMMUTABLE_STATUSES,
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
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Supervisor correction note for PUBLISHED / REVIEWED audits. The
  // wizard normally treats those as read-only — this single field is
  // the only mutation allowed once the audit is locked.
  const [correctionNote, setCorrectionNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Once an audit is PUBLISHED / REVIEWED nothing in this wizard should
  // be editable. The supervisor is now in "view what the agent sees" mode.
  const isReadOnly =
    audit !== null &&
    AUDIT_IMMUTABLE_STATUSES.includes(audit.status);
  const isSubmitted = audit?.status === AuditStatus.SUBMITTED;

  // Draft answers (per-question + section remarks)
  const [answers, setAnswers] = useState<AnswerDraftMap>({});
  const [sectionRemarks, setSectionRemarks] = useState<SectionRemarkMap>({});
  const [overallComment, setOverallComment] = useState("");

  // ACPT — qualitative, non-scoring call observations.
  const [acptCategory, setAcptCategory] = useState<string | null>(null);
  const [acptLevel2, setAcptLevel2] = useState("");
  const [acptLevel3, setAcptLevel3] = useState("");

  // Audit-level qualitative notes (replaces per-section remarks).
  const [callObservation, setCallObservation] = useState("");
  const [areaOfImprovement, setAreaOfImprovement] = useState("");

  const autosaveTimer = useRef<number | null>(null);
  const dirtyRef = useRef<{
    answerIds: Set<number>;
    sectionIds: Set<number>;
    overallChanged: boolean;
    acptChanged: boolean;
    notesChanged: boolean;
  }>({ answerIds: new Set(), sectionIds: new Set(), overallChanged: false, acptChanged: false, notesChanged: false });

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
    setCorrectionNote(detail.supervisorCorrectionNote ?? "");
    // ACPT fields — null on legacy audits, hydrate gracefully.
    setAcptCategory(detail.acptCategory ?? null);
    setAcptLevel2(detail.acptLevel2 ?? "");
    setAcptLevel3(detail.acptLevel3 ?? "");

    // Audit-level notes — null on legacy audits.
    setCallObservation(detail.callObservation ?? "");
    setAreaOfImprovement(detail.areaOfImprovement ?? "");

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
      case "group-project":
        // Both a group and a project must be selected in the merged step.
        return Boolean(groupName && projectId);
      case "call":
        // Call reference / recording id must be exactly 10 numeric
        // digits — same regex the backend DTO enforces.
        return /^\d{10}$/.test(callReference.trim());
      case "scorecard":
        return Boolean(audit && audit.sections.length);
      case "acpt":
        // ACPT is fully optional — any combination of fields (including
        // all blank) is valid. The supervisor can always advance.
        return true;
      case "review":
        return true;
    }
  };

  const reachable: WizardStepId[] = useMemo(() => {
    const out: WizardStepId[] = ["agent"];
    if (agentId) out.push("group-project");
    if (projectId) out.push("call");
    if (audit) out.push("scorecard");
    if (audit && audit.sections.length) out.push("acpt");
    if (audit && audit.sections.length) out.push("review");
    return out;
  }, [agentId, projectId, audit]);

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
  //  Auto-advance: selecting an agent / group / project should move
  //  the wizard to the next step automatically. The user only has to
  //  click Continue on free-text steps (call reference) and
  //  scoring / review where intentional confirmation matters.
  // ------------------------------------------------------------
  const handleSelectAgent = useCallback((id: string) => {
    setAgentId(id);
    setStep("group-project");
  }, []);

  const handleSelectGroup = useCallback(
    (name: string, projectsInGroup: Project[]) => {
      setGroupName(name);
      // If the previously selected project no longer belongs to the new
      // group, clear it so we don't carry stale state forward.
      setProjectId((prev) => {
        if (prev && !projectsInGroup.some((p) => p.id === prev)) return null;
        return prev;
      });
      // Stay on the merged step — project list renders below once a group is picked.
    },
    [],
  );

  const handleSelectProject = useCallback((id: number) => {
    setProjectId(id);
    setStep("call");
  }, []);

  // ------------------------------------------------------------
  //  Autosave
  // ------------------------------------------------------------

  const flushAutosave = useCallback(async () => {
    if (!audit) return;
    const dirty = dirtyRef.current;
    if (
      dirty.answerIds.size === 0 &&
      dirty.sectionIds.size === 0 &&
      !dirty.overallChanged &&
      !dirty.acptChanged &&
      !dirty.notesChanged
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
      // ACPT fields are sent as a group — if any changed we persist all three
      // so the server always sees a consistent snapshot.
      ...(dirty.acptChanged
        ? {
            acptCategory,
            acptLevel2: acptLevel2.trim() || null,
            acptLevel3: acptLevel3.trim() || null,
          }
        : {}),
      // Audit-level qualitative notes.
      ...(dirty.notesChanged
        ? {
            callObservation: callObservation.trim() || null,
            areaOfImprovement: areaOfImprovement.trim() || null,
          }
        : {}),
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
      dirty.acptChanged = false;
      dirty.notesChanged = false;
    } catch (e) {
      console.error(e);
      toast.error("Autosave failed");
    } finally {
      setSaving(false);
    }
  }, [audit, answers, sectionRemarks, overallComment, acptCategory, acptLevel2, acptLevel3, callObservation, areaOfImprovement]);

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

  // ACPT field change handlers — all three mark the same acptChanged flag
  // so the flush sends them together as a consistent group.
  const onAcptCategory = useCallback(
    (val: string | null) => {
      setAcptCategory(val);
      dirtyRef.current.acptChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onAcptLevel2 = useCallback(
    (val: string) => {
      setAcptLevel2(val);
      dirtyRef.current.acptChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onAcptLevel3 = useCallback(
    (val: string) => {
      setAcptLevel3(val);
      dirtyRef.current.acptChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // Audit-level qualitative note handlers.
  const onCallObservation = useCallback(
    (val: string) => {
      setCallObservation(val);
      dirtyRef.current.notesChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  const onAreaOfImprovement = useCallback(
    (val: string) => {
      setAreaOfImprovement(val);
      dirtyRef.current.notesChanged = true;
      scheduleAutosave();
    },
    [scheduleAutosave],
  );

  // ------------------------------------------------------------
  //  Submit
  // ------------------------------------------------------------

  /**
   * Pre-flight check — verify every required question has a non-empty
   * answer in the current local UI state. Catches the "remaining
   * questions" backend rejection before the submit round-trip and gives
   * the user an actionable count rather than a generic 400.
   */
  const findMissingRequired = useCallback((): {
    sectionTitle: string;
    questionPrompt: string;
  }[] => {
    if (!audit) return [];
    const missing: { sectionTitle: string; questionPrompt: string }[] = [];
    for (const section of audit.sections) {
      for (const q of section.questions) {
        if (!q.required) continue;
        const draft = answers[q.id];
        const v = draft?.value;
        if (v === null || v === undefined || String(v).trim() === "") {
          missing.push({
            sectionTitle: section.title,
            questionPrompt: q.prompt,
          });
        }
      }
    }
    return missing;
  }, [audit, answers]);

  const handleSubmit = useCallback(async () => {
    if (!audit) return;

    // ----- 1. Pre-flight: surface UI/state mismatches before submit ----
    const missing = findMissingRequired();
    if (missing.length > 0) {
      toast.error(
        `Cannot submit yet — ${missing.length} required question${
          missing.length === 1 ? "" : "s"
        } still need an answer.`,
      );
      // Drop the user back on the scorecard step so they can fix it.
      setStep("scorecard");
      return;
    }

    // ----- 2. Cancel any pending debounced autosave and flush dirty ----
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    await flushAutosave();

    // ----- 3. Build the *full authoritative* payload from local state --
    // We never rely on autosave alone — the submit always sends the
    // complete answer map, every section remark, and the overall
    // comment as the user currently sees them in the UI. That removes
    // any drift between in-flight autosaves and what we're submitting.
    const fullAnswers = Object.entries(answers).map(([questionId, draft]) => ({
      questionId: Number(questionId),
      value: draft?.value ?? null,
      remark: draft?.remark ?? null,
    }));

    const fullSectionRemarks = Object.entries(sectionRemarks).map(
      ([sectionId, remark]) => ({
        sectionId: Number(sectionId),
        remark: remark ?? null,
      }),
    );

    setSubmitting(true);
    try {
      const finalAudit = await submitAudit(audit.id, {
        overallComment,
        answers: fullAnswers,
        sectionRemarks: fullSectionRemarks,
        // Include the latest ACPT state so a submit without a prior autosave
        // still persists them. Server treats undefined as "leave unchanged".
        acptCategory,
        acptLevel2: acptLevel2.trim() || null,
        acptLevel3: acptLevel3.trim() || null,
        callObservation: callObservation.trim() || null,
        areaOfImprovement: areaOfImprovement.trim() || null,
      });
      setAudit(finalAudit);
      // Re-ingest the finalized server detail so the UI mirrors what
      // the backend saved (including normalized scores, fatal flags).
      ingestDetail(finalAudit);
      // Reset the dirty tracker — submit just flushed everything.
      dirtyRef.current.answerIds.clear();
      dirtyRef.current.sectionIds.clear();
      dirtyRef.current.overallChanged = false;
      dirtyRef.current.acptChanged = false;
      dirtyRef.current.notesChanged = false;
      toast.success(`Audit ${finalAudit.auditCode} submitted`);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not submit audit");
    } finally {
      setSubmitting(false);
    }
  }, [
    audit,
    flushAutosave,
    overallComment,
    answers,
    sectionRemarks,
    findMissingRequired,
    ingestDetail,
  ]);

  /**
   * Publish a SUBMITTED audit so the agent can see it. Locks the audit
   * for everyone after this — the supervisor cannot reopen / edit answers
   * once this completes.
   */
  const handlePublish = useCallback(async () => {
    if (!audit) return;
    setPublishing(true);
    try {
      const published = await publishAudit(audit.id);
      setAudit(published);
      toast.success(`Audit ${published.auditCode} published to agent`);
      onSubmitted(published);
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not publish audit");
    } finally {
      setPublishing(false);
    }
  }, [audit, onSubmitted]);

  /**
   * Discard a DRAFT or IN_PROGRESS audit. Soft-deletes server-side
   * (the row is hidden from active lists). Confirmation comes from the
   * modal so we never auto-discard on a stray click. Cancels any
   * pending autosave timer to avoid resurrecting state after delete.
   */
  const handleDiscardConfirm = useCallback(async () => {
    if (!audit) return;
    setDiscarding(true);
    try {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      await discardAudit(audit.id);
      toast.success(`Audit ${audit.auditCode} discarded`);
      setDiscardOpen(false);
      // Treat the same as a cancel — pop the user back to whatever
      // list view opened the wizard so the now-deleted row vanishes.
      onCancel();
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not discard audit");
    } finally {
      setDiscarding(false);
    }
  }, [audit, onCancel]);

  /** Whether the discard button should appear in the header. */
  const canDiscard =
    audit !== null &&
    (audit.status === AuditStatus.DRAFT ||
      audit.status === AuditStatus.IN_PROGRESS);

  /**
   * Whether the supervisor correction-note editor should appear. Only
   * surfaces on locked audits (PUBLISHED / REVIEWED) — published audits
   * are immutable in every other respect, but a separate, append-only
   * note is the safe way to record post-publish context.
   */
  const canEditCorrectionNote =
    audit !== null &&
    (audit.status === AuditStatus.PUBLISHED ||
      audit.status === AuditStatus.REVIEWED);

  const handleSaveCorrectionNote = useCallback(async () => {
    if (!audit) return;
    setSavingNote(true);
    try {
      const trimmed = correctionNote.trim();
      const updated = await setCorrectionNote(
        audit.id,
        trimmed.length === 0 ? null : trimmed,
      );
      setAudit(updated);
      ingestDetail(updated);
      toast.success("Correction note saved");
    } catch (e) {
      const err = e as AxiosError<{ message?: string | string[] }>;
      const raw = err.response?.data?.message;
      const msg = Array.isArray(raw) ? raw.join(", ") : raw;
      toast.error(msg ?? "Could not save correction note");
    } finally {
      setSavingNote(false);
    }
  }, [audit, correctionNote, ingestDetail]);

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
            {canDiscard && (
              <button
                type="button"
                onClick={() => setDiscardOpen(true)}
                disabled={discarding}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-3 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Discard
              </button>
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
                  onClick={() => handleSelectAgent(a.id)}
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

      {step === "group-project" && (
        <div className="flex flex-col gap-4">
          {/* Group picker */}
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
                    onClick={() => handleSelectGroup(g.groupName, g.projects)}
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

          {/* Project picker — appears inline once a group is selected */}
          {groupName && (
            <StepShell title={`Projects in ${groupName}`}>
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
                        onClick={() => handleSelectProject(p.id)}
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
        </div>
      )}

      {step === "call" && (
        <StepShell title="Call reference">
          <div className="max-w-md">
            <label className="text-xs font-medium text-fg-muted">
              Call reference / recording id
            </label>
            <input
              value={callReference}
              // Input mask: keep digits only and cap at 10 characters so
              // the field cannot accept anything that would fail backend
              // validation. Trimming + stripping non-digits handles the
              // common paste case (e.g. "CALL-1234567890").
              onChange={(e) => {
                const digits = e.target.value.replace(/\D+/g, "").slice(0, 10);
                setCallReference(digits);
              }}
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              placeholder="e.g. 1234567890"
              className={cn(fieldClass, "mt-1.5 tracking-widest tabular-nums")}
              autoFocus
            />
            <p className="mt-2 text-xs text-fg-subtle">
              Must be exactly 10 digits — the recording / call ID. Unique per agent.
            </p>
            {callReference.length > 0 && callReference.length < 10 && (
              <p className="mt-1 text-xs text-warning">
                {10 - callReference.length} more digit
                {10 - callReference.length === 1 ? "" : "s"} needed.
              </p>
            )}
          </div>
        </StepShell>
      )}

      {step === "scorecard" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Question list — only this column scrolls. The header card,
              live-score panel and footer stay anchored so the supervisor
              never loses context while filling a long template. */}
          <div className="flex min-h-0 flex-col">
            {!audit || !audit.sections.length ? (
              <AppCard padding="sm">
                <p className="text-sm text-fg-muted">
                  Loading the default QA template…
                </p>
              </AppCard>
            ) : (
              <div className="max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                <ScoreCardFiller
                  sections={audit.sections}
                  answers={answers}
                  readOnly={isReadOnly}
                  onAnswer={onAnswer}
                  onAnswerRemark={onAnswerRemark}
                />
              </div>
            )}
          </div>

          {audit && audit.sections.length > 0 && (
            <div className="lg:sticky lg:top-4 lg:self-start">
              <LiveScorePanel audit={audit} answers={answers} />
            </div>
          )}
        </div>
      )}

      {step === "acpt" && audit && (
        <StepShell title="ACPT — Qualitative call observations">
          <p className="mb-4 text-xs text-fg-subtle">
            ACPT captures qualitative observations about this call. These fields
            are strictly informational and never affect the QA score.
          </p>

          {/* Category selector */}
          <div className="mb-4 max-w-sm">
            <label className="text-xs font-medium text-fg-muted">
              Category
            </label>
            <select
              value={acptCategory ?? ""}
              onChange={(e) =>
                onAcptCategory(e.target.value === "" ? null : e.target.value)
              }
              disabled={isReadOnly}
              className={cn(
                fieldClass,
                "mt-1.5",
                isReadOnly && "cursor-not-allowed opacity-70",
              )}
            >
              <option value="">— Select a category —</option>
              {["Agent", "Customer", "Process", "Technology"].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Level 2 */}
          <div className="mb-4">
            <label className="text-xs font-medium text-fg-muted">
              Level 2 — observations
            </label>
            <textarea
              rows={4}
              value={acptLevel2}
              onChange={(e) => onAcptLevel2(e.target.value)}
              placeholder="Describe what you observed at level 2…"
              disabled={isReadOnly}
              className={cn(
                fieldClass,
                "mt-1.5 h-auto resize-none py-2 leading-relaxed",
                isReadOnly && "cursor-not-allowed opacity-70",
              )}
            />
          </div>

          {/* Level 3 */}
          <div>
            <label className="text-xs font-medium text-fg-muted">
              Level 3 — root cause / detail
            </label>
            <textarea
              rows={4}
              value={acptLevel3}
              onChange={(e) => onAcptLevel3(e.target.value)}
              placeholder="Provide root-cause detail or further context…"
              disabled={isReadOnly}
              className={cn(
                fieldClass,
                "mt-1.5 h-auto resize-none py-2 leading-relaxed",
                isReadOnly && "cursor-not-allowed opacity-70",
              )}
            />
          </div>

          {/* Audit-level qualitative notes */}
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-4 text-[11px] font-medium uppercase tracking-wider text-fg-muted">
              Call notes
            </p>

            <div className="mb-4">
              <label className="text-xs font-medium text-fg-muted">
                Call Observation
              </label>
              <textarea
                rows={4}
                value={callObservation}
                onChange={(e) => onCallObservation(e.target.value)}
                placeholder="Describe what was observed during the call…"
                disabled={isReadOnly}
                className={cn(
                  fieldClass,
                  "mt-1.5 h-auto resize-none py-2 leading-relaxed",
                  isReadOnly && "cursor-not-allowed opacity-70",
                )}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-fg-muted">
                Area of Improvement
              </label>
              <textarea
                rows={4}
                value={areaOfImprovement}
                onChange={(e) => onAreaOfImprovement(e.target.value)}
                placeholder="Identify areas where the agent can improve…"
                disabled={isReadOnly}
                className={cn(
                  fieldClass,
                  "mt-1.5 h-auto resize-none py-2 leading-relaxed",
                  isReadOnly && "cursor-not-allowed opacity-70",
                )}
              />
            </div>
          </div>

          {isReadOnly && (
            <p className="mt-3 inline-flex items-center gap-1 text-xs text-fg-subtle">
              <Lock className="h-3 w-3" />
              Audit is locked — ACPT observations are read-only.
            </p>
          )}
        </StepShell>
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

              {/* ACPT summary — only shown when at least one field is filled */}
              {(acptCategory || acptLevel2.trim() || acptLevel3.trim()) && (
                <div className="mt-4 rounded-md border border-border bg-bg-muted p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    ACPT observations
                  </p>
                  <dl className="grid grid-cols-1 gap-2 text-sm">
                    {acptCategory && (
                      <ReviewItem label="Category" value={acptCategory} />
                    )}
                    {acptLevel2.trim() && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                          Level 2
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">
                          {acptLevel2.trim()}
                        </dd>
                      </div>
                    )}
                    {acptLevel3.trim() && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                          Level 3
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">
                          {acptLevel3.trim()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Call notes summary — only shown when at least one is filled */}
              {(callObservation.trim() || areaOfImprovement.trim()) && (
                <div className="mt-4 rounded-md border border-border bg-bg-muted p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                    Call notes
                  </p>
                  <dl className="grid grid-cols-1 gap-3 text-sm">
                    {callObservation.trim() && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                          Call Observation
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">
                          {callObservation.trim()}
                        </dd>
                      </div>
                    )}
                    {areaOfImprovement.trim() && (
                      <div>
                        <dt className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
                          Area of Improvement
                        </dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">
                          {areaOfImprovement.trim()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </StepShell>

            <StepShell title="Overall comment">
              <textarea
                rows={5}
                value={overallComment}
                onChange={(e) => onOverallComment(e.target.value)}
                placeholder="Summarize the audit outcome and feedback for the agent…"
                disabled={isReadOnly}
                className={cn(
                  fieldClass,
                  "h-auto resize-none py-2 leading-relaxed",
                  isReadOnly && "cursor-not-allowed opacity-70",
                )}
              />
              {isReadOnly && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-fg-subtle">
                  <Lock className="h-3 w-3" />
                  Audit is locked — the agent has been notified.
                </p>
              )}
            </StepShell>

            {/* Safe post-publish edit surface: a correction note that the
                supervisor can append without mutating the locked audit. */}
            {canEditCorrectionNote && (
              <StepShell title="Supervisor correction note">
                <p className="mb-2 text-xs text-fg-subtle">
                  This audit is locked, so its score, answers, and overall
                  comment can no longer change. You can leave a separate
                  correction note here — it's surfaced to the agent
                  alongside the audit but never changes the original record.
                </p>
                <textarea
                  rows={4}
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="e.g. Re: agent's dispute — fatal call-out at 02:14 was correct because…"
                  className={cn(
                    fieldClass,
                    "h-auto resize-none py-2 leading-relaxed",
                  )}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-fg-subtle">
                    {correctionNote.trim().length}/2000 characters
                  </span>
                  <div className="flex items-center gap-2">
                    {correctionNote.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCorrectionNote("")}
                        disabled={savingNote}
                        className="inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg disabled:opacity-60"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSaveCorrectionNote()}
                      disabled={
                        savingNote ||
                        correctionNote.trim() ===
                          (audit?.supervisorCorrectionNote ?? "")
                      }
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg",
                        "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-50",
                      )}
                    >
                      {savingNote ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save note
                    </button>
                  </div>
                </div>
              </StepShell>
            )}
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

            {(step === "scorecard" && audit?.sections.length) ||
            step === "acpt" ? (
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

            {step === "review" && isReadOnly ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-3 text-sm font-medium text-success">
                <Lock className="h-4 w-4" />
                Audit locked
              </span>
            ) : step === "review" && isSubmitted ? (
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing || busy}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
                  "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
                )}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish to agent
              </button>
            ) : step === "review" ? (
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

      {/* Discard confirmation */}
      <Modal
        open={discardOpen}
        onOpenChange={(open) => !discarding && setDiscardOpen(open)}
        title="Discard this audit?"
        description="This draft will be hidden from your active audits list and cannot be re-opened from the wizard. Published audits are never affected."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDiscardOpen(false)}
              disabled={discarding}
              className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDiscardConfirm()}
              disabled={discarding}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md bg-danger px-3 text-sm font-medium text-white",
                "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60",
              )}
            >
              {discarding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Discard audit
            </button>
          </>
        }
      >
        <div className="text-sm text-fg-muted">
          {audit ? (
            <p>
              <span className="font-medium text-fg">{audit.auditCode}</span>
              {" — "}
              {audit.agent.name} · {audit.projectNameSnapshot}
            </p>
          ) : (
            <p>Discarding the current draft.</p>
          )}
        </div>
      </Modal>
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
