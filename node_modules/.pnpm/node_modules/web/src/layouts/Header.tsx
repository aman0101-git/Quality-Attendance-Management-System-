import { Bell, Menu } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuthStore } from "@/features/auth/store/authStore";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface HeaderProps {
  onOpenMobileNav: () => void;
}

/**
 * Sticky top header. Contains mobile-nav trigger, command bar,
 * notifications, theme toggle and user menu.
 */
export function Header({ onOpenMobileNav }: HeaderProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const initials = user?.name
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") ?? "?";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-border",
        "glass-panel-strong px-4 lg:px-6"
      )}
    >
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden flex-1 max-w-md sm:block">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Search agents, audits, calls…"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 inline-flex h-2 w-2 rounded-full bg-accent ring-2 ring-bg-elevated" />
        </button>

        <ThemeToggle />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 transition-colors hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                {initials}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-medium text-fg">
                  {user?.name ?? "Guest"}
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-fg-subtle">
                  {user?.role ?? "—"}
                </span>
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                "z-50 min-w-[200px] rounded-md border border-border bg-surface p-1.5",
                "shadow-elev-3"
              )}
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-xs uppercase tracking-wider text-fg-subtle">
                Signed in as
              </DropdownMenu.Label>
              <div className="px-2 pb-2 text-sm font-medium text-fg">
                {user?.name ?? "Guest"}
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="flex cursor-pointer select-none items-center rounded px-2 py-1.5 text-sm text-fg-muted outline-none data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger"
              >
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export default Header;
