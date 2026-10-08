"use client";
import { useEffect, useRef, useState } from "react";
import { createConnectionMonitor, type ConnectionState } from "./connection-monitor";

export function useConnectionMonitor(onChange: (state: ConnectionState, recovered: boolean) => void) {
  const [state, setState] = useState<ConnectionState>("online");
  const callback = useRef(onChange); callback.current = onChange;
  useEffect(() => {
    const monitor = createConnectionMonitor({
      online: () => navigator.onLine,
      probe: async signal => {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "/api";
        const response = await fetch(`${base.replace(/\/$/, "")}/health/ready`, {
          cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
        });
        if (!response.ok) return false;
        const payload: unknown = await response.json();
        return typeof payload === "object" && payload !== null && "status" in payload && payload.status === "ready";
      },
      changed: (next, recovered) => { setState(next); callback.current(next, recovered); },
    });
    const check = () => { if (document.visibilityState === "visible") void monitor.check(); };
    window.addEventListener("offline", monitor.disconnect);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 15000);
    check();
    return () => {
      monitor.dispose(); window.clearInterval(timer);
      window.removeEventListener("offline", monitor.disconnect);
      window.removeEventListener("online", check); window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return state;
}
