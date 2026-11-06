"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Workspace } from "../workspaces/workspace";
import { setBuyerMode } from "../../../buyer-web/app/buyer-context";

export function ClinicEntry({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Entering the clinic explicitly selects its context; later recovery failures
    // may still block it without this boundary resetting their state.
    setBuyerMode("organization");
    setReady(true);
  }, []);
  return <Workspace role="clinic" preparing={!ready}>{children}</Workspace>;
}
