import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Wraps the app with `next-themes` configured for class-based,
 * dark-default theming with persistence.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey="qams.theme"
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemeProvider>
  );
}

export default ThemeProvider;
