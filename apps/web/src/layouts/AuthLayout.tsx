import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Centered layout used by login / unauthenticated screens.
 * Renders a subtle gradient background and the brand block
 * alongside the form slot.
 */
export function AuthLayout({
  children,
  title = "Welcome back",
  description = "Sign in to your QAMS workspace.",
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      {/* Decorative ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[500px] rounded-full bg-info/10 blur-3xl" />
      </div>

      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-accent to-info text-accent-fg shadow-elev-1">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-fg">QAMS</p>
            <p className="text-[10px] uppercase tracking-wider text-fg-subtle">
              Quality &amp; Attendance
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <div
          className={cn(
            "w-full max-w-md rounded-xl glass-panel-strong",
            "p-8 shadow-elev-3 animate-fade-up"
          )}
        >
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-fg">
              {title}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
