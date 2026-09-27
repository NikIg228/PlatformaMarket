/** One refresh at a time, no requests while hidden, no implicit mutation. */
export function scheduleCartRefresh(environment: {
  visible: () => boolean; blocked: () => boolean; refresh: () => Promise<void>;
  interval: (callback: () => void, ms: number) => () => void;
  onWake: (callback: () => void) => () => void;
}) {
  let disposed = false, running = false;
  let lastStarted = -Infinity;
  const tick = () => {
    if (disposed || running || !environment.visible() || environment.blocked() || Date.now() - lastStarted < 1000) return;
    running = true; lastStarted = Date.now();
    void environment.refresh().catch(() => { /* caller owns visible error feedback */ }).finally(() => { running = false; });
  };
  const stopInterval = environment.interval(tick, 60_000);
  const stopWake = environment.onWake(tick);
  return () => { disposed = true; stopInterval(); stopWake(); };
}
