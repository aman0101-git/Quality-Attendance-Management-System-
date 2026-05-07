import { useEffect, useState } from "react";

const STORAGE_KEY = "qams.sidebar.collapsed";

/**
 * Persists collapsed/expanded state of the desktop sidebar.
 */
export function useSidebarState(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultCollapsed;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? defaultCollapsed : stored === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return {
    collapsed,
    setCollapsed,
    toggle: () => setCollapsed((prev) => !prev),
  };
}
