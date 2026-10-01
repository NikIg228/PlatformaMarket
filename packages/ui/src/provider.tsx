"use client";
import { FluentProvider, webDarkTheme } from "@fluentui/react-components";
import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dentMarketLightTheme } from "./light-theme";
import { installInputModality } from "./input-modality";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  toggle: () => undefined,
});


export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");
  useEffect(() => installInputModality(document), []);

  useEffect(() => {
    const stored = window.localStorage.getItem("marketplace-theme");
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (stored === "light" || stored === "dark") setMode(stored);
    else setMode(media.matches ? "dark" : "light");
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === "light" ? "dark" : "light";
          window.localStorage.setItem("marketplace-theme", next);
          return next;
        }),
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider
        className="mp-provider"
        theme={mode === "dark" ? webDarkTheme : dentMarketLightTheme}
      >
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
}
