"use client";
import { FluentProvider } from "@fluentui/react-components";
import { useEffect, type ReactNode } from "react";
import { dentMarketLightTheme } from "./light-theme";
import { installInputModality } from "./input-modality";

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  useEffect(() => installInputModality(document), []);
  // Only the approved light contract is supported. Keep stored preferences
  // untouched; an OS preference must not create a half-dark workspace.
  return (
      <FluentProvider
        className="mp-provider"
        theme={dentMarketLightTheme}
      >
        {children}
      </FluentProvider>
  );
}
