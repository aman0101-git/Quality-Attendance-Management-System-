import type { ReactNode } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";

interface WelcomeHeaderProps {
  /** Optional override (e.g. "Operations overview") */
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}

function partOfDay() {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Hero greeting block at the top of each dashboard.
 */
export function WelcomeHeader({
  eyebrow,
  description,
  actions,
}: WelcomeHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          {partOfDay()}, <span className="text-gradient-accent">{firstName}</span>
        </h1>
        {description && (
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export default WelcomeHeader;
