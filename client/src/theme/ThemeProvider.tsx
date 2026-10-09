import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api";
import { applyTokens, resolveColors } from "./tokens";

interface ThemeState {
  overrides: Record<string, string>;
  colors: ReturnType<typeof resolveColors>;
  /** Applique des couleurs (aperçu en direct depuis l'admin). */
  preview: (overrides: Record<string, string>) => void;
}

const ThemeContext = createContext<ThemeState>({
  overrides: {},
  colors: resolveColors(),
  preview: () => {}
});

export const useTheme = () => useContext(ThemeContext);

/** Charge les couleurs personnalisées depuis l'API et les applique à tout le site. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const preview = useCallback((next: Record<string, string>) => {
    setOverrides(next);
    applyTokens(next);
  }, []);

  useEffect(() => {
    api
      .settings()
      .then((s) => preview(s.colors ?? {}))
      .catch(() => {});
  }, [preview]);

  return (
    <ThemeContext.Provider value={{ overrides, colors: resolveColors(overrides), preview }}>
      {children}
    </ThemeContext.Provider>
  );
}
