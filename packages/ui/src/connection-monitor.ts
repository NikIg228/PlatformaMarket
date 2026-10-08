export type ConnectionState = "online" | "offline" | "checking" | "unavailable";

/** Only an actual successful probe confirms recovery; browser online is a hint. */
export function createConnectionMonitor(options: {
  online: () => boolean;
  probe: (signal: AbortSignal) => Promise<boolean>;
  changed: (state: ConnectionState, recovered: boolean) => void;
}) {
  let state: ConnectionState = "online", disposed = false, interrupted = false;
  let flight: AbortController | null = null;
  const publish = (next: ConnectionState, recovered = false) => {
    if (disposed || next === state) return;
    state = next; options.changed(next, recovered);
  };
  const disconnect = () => {
    interrupted = true; flight?.abort(); flight = null; publish("offline");
  };
  const check = async () => {
    if (disposed) return;
    if (!options.online()) { disconnect(); return; }
    if (!interrupted || flight) return;
    const controller = new AbortController(); flight = controller; publish("checking");
    let ok = false;
    try { ok = await options.probe(controller.signal); } catch { /* Keep recovery unconfirmed. */ }
    if (disposed || flight !== controller) return;
    flight = null;
    if (!options.online()) { disconnect(); return; }
    if (ok) { interrupted = false; publish("online", true); }
    else publish("unavailable");
  };
  return { check, disconnect, dispose: () => { disposed = true; flight?.abort(); flight = null; } };
}
