"use client";
import { createLightTheme, FluentProvider, webDarkTheme, type BrandVariants } from "@fluentui/react-components";
import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

const dentMarketBrand: BrandVariants = {
  10: "#f3fff9",
  20: "#ddf8eb",
  30: "#b9efd5",
  40: "#87e3b8",
  50: "#4fd49a",
  60: "#1fbe7d",
  70: "#009f67",
  80: "#007a59",
  90: "#00664b",
  100: "#00543e",
  110: "#004530",
  120: "#003a29",
  130: "#002f22",
  140: "#00261b",
  150: "#001e15",
  160: "#00180f",
};

const dentMarketLightTheme = createLightTheme(dentMarketBrand);

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
