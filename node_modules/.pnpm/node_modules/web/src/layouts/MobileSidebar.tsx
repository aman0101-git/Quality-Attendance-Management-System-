import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, ShieldCheck, X } from "lucide-react";
import { useAuthStore } from "@/features/auth/store/authStore";
import { getSidebarGroups } from "@/components/navigation/sidebar.config";
import { SidebarGroup } from "@/components/navigation/SidebarGroup";
import type { UserRole } from "@/types/navigation";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mobile drawer sidebar. Powered by Radix Dialog so it's
 * fully accessible (focus trap, escape, aria semantics).
 */
export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = (user?.role as UserRole | undefined) ?? null;
  const groups = getSidebarGroups(role);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 360, damping: 36 }}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r border-border bg-bg-elevated lg:hidden"
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Primary application navigation
                </Dialog.Description>

                <div className="flex h-[60px] items-center justify-between border-b border-border px-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-accent to-info text-accent-fg">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold tracking-tight text-fg">
                      QAMS
                    </p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close navigation"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-muted hover:text-fg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Dialog.Close>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4">
                  <div className="flex flex-col gap-4">
                    {groups.map((group, i) => (
                      <SidebarGroup
                        key={group.heading ?? i}
                        group={group}
                        onNavigate={() => onOpenChange(false)}
                      />
                    ))}
                  </div>
                </nav>

                <div className="border-t border-border p-3">
                  {user && (
                    <div className="mb-3 flex items-center gap-3 rounded-md border border-border bg-surface p-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                        {user.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-fg-subtle">
                          {user.role}
                        </p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      onOpenChange(false);
                    }}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-sm font-medium text-fg-muted hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default MobileSidebar;
