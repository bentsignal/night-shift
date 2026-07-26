import type { ReactNode } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";

export type Theme = "dark" | "light" | "system";

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "code-theme",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      disableTransitionOnChange
      enableSystem
      storageKey={storageKey}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, setTheme } = useNextTheme();
  return {
    theme: (theme ?? "dark") as Theme,
    setTheme: (nextTheme: Theme) => setTheme(nextTheme),
  };
}
