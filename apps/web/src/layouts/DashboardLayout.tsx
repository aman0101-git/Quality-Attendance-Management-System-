import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileSidebar from "./MobileSidebar";
import Header from "./Header";
import { useSidebarState } from "@/hooks/useSidebarState";

/**
 * Top-level layout for authenticated routes.
 *
 * - Renders persistent desktop sidebar + mobile drawer
 * - Sticky glass header
 * - Renders the active route via React Router's <Outlet />
 *
 * NOTE: We deliberately do NOT wrap <Outlet /> in framer-motion's
 * `<AnimatePresence mode="wait">` here. That setup created a stacking
 * context with `transform: translate3d(...)` and `will-change` on
 * every page, which compounded with PageContainer's and per-page
 * motion wrappers — three nested transformed containers were enough
 * to break text-selection hit-testing in Chromium/Brave (Ctrl+A /
 * Ctrl+C / right-click "Copy" stopped working, and click positions
 * could land "between" the transformed layers). Each individual page
 * still owns its own fade-in via PageContainer, so the visual feel
 * is preserved.
 */
export function DashboardLayout() {
  const { collapsed, toggle } = useSidebarState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen w-full bg-bg text-fg">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggle} />
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
