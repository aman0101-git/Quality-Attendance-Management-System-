import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStepId =
  | "agent"
  | "group"
  | "project"
  | "call"
  | "scorecard"
  | "review";

export interface WizardStep {
  id: WizardStepId;
  label: string;
  description?: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: "agent", label: "Agent", description: "Pick the agent under review" },
  { id: "group", label: "Group", description: "Group / line of business" },
  { id: "project", label: "Project", description: "Project the call belongs to" },
  { id: "call", label: "Call", description: "Reference identifier" },
  { id: "scorecard", label: "Score", description: "Score against QA template" },
  { id: "review", label: "Review", description: "Confirm and submit" },
];

interface WizardStepsProps {
  current: WizardStepId;
  /** Steps that have been completed/visited (used for navigation). */
  reachable: WizardStepId[];
  onJump?: (id: WizardStepId) => void;
}

export function WizardSteps({ current, reachable, onJump }: WizardStepsProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
      {WIZARD_STEPS.map((step, i) => {
        const isCurrent = step.id === current;
        const isCompleted = currentIndex > i;
        const canJump = reachable.includes(step.id);

        return (
          <li
            key={step.id}
            className={cn(
              "flex items-center gap-2 sm:flex-1",
              i !== WIZARD_STEPS.length - 1 && "sm:pr-2",
            )}
          >
            <button
              type="button"
              disabled={!canJump || !onJump}
              onClick={() => onJump?.(step.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                isCurrent
                  ? "border-accent/40 bg-accent/10"
                  : isCompleted
                    ? "border-border bg-bg-elevated"
                    : "border-dashed border-border bg-transparent opacity-80",
                canJump && !isCurrent && "hover:bg-bg-muted",
                !canJump && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isCurrent
                    ? "bg-accent text-accent-fg"
                    : isCompleted
                      ? "bg-success/20 text-success"
                      : "bg-bg-muted text-fg-muted",
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs font-medium",
                    isCurrent ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="block truncate text-[10px] text-fg-subtle">
                    {step.description}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default WizardSteps;
