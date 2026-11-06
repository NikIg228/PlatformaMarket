"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { DmButton } from "@marketplace/ui/controls";
import { ErrorState, LoadingState } from "@marketplace/ui/primitives";
import { deferredOfferModule } from "./deferred-offer-module";

export function deferredOffer<P extends object>(
  load: () => Promise<ComponentType<P>>,
  options: { label: string; active?: (props: P) => boolean; cancel: (props: P) => void },
) {
  const module = deferredOfferModule(load);
  return function DeferredOffer(props: P) {
    const [Component, setComponent] = useState<ComponentType<P> | undefined>(() => module.current());
    const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
    const active = options.active?.(props) ?? true;
    const fallback = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!active || Component) return;
      let alive = true;
      setFailed(false);
      void module.load().then(component => {
        if (alive) setComponent(() => component);
      }).catch(() => { if (alive) setFailed(true); });
      return () => { alive = false; };
    }, [active, Component, attempt]);
    useEffect(() => {
      if (active && !Component) fallback.current?.focus();
    }, [active, Component, attempt]);
    // Retain the loaded drawer while closed so its exit motion can finish navigation.
    if (Component) return <Component {...props} />;
    if (!active) return null;
    return <div ref={fallback} tabIndex={-1} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); options.cancel(props); }
    }}>
      {failed ? <ErrorState description="Не удалось загрузить форму. Проверьте соединение и повторите попытку." action={<DmButton onClick={() => setAttempt(value => value + 1)}>Повторить загрузку</DmButton>} /> : <LoadingState label={options.label} />}
      <DmButton onClick={() => options.cancel(props)}>Отмена</DmButton>
    </div>;
  };
}
