"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MarketplaceApiError } from "@marketplace/api-client";
import type { PersonalCart, PersonalCartValidation, PersonalSession } from "@marketplace/schemas";
import { ActionFeedback, DmButton, DmDropdown, DmFeedback, DmField, EmptyState, ErrorState, LoadingState, PageHeader, Section, formatMoney } from "@marketplace/ui";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { buyerMode, setBuyerMode, useBuyerMode } from "../../buyer-context";
import { personalApiFor, personalSessionStore, usePersonalSession } from "../../personal-session";
import { loginUrl } from "../../public-links";
import { PersonalCartItem } from "./cart-item";
import { personalCartCopy, type PersonalCartCopy } from "./copy";
import styles from "./personal-cart.module.css";

function CartContents({ session, t }: { session: PersonalSession; t: PersonalCartCopy }) {
  const api = useMemo(() => personalApiFor(session.sessionId), [session.sessionId]);
  const [cart, setCart] = useState<PersonalCart | null>(null);
  const [checked, setChecked] = useState<PersonalCartValidation | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(false), [needsCheck, setNeedsCheck] = useState(false);
  const alive = useRef(true), lock = useRef(false), revision = useRef(0);
  const heading = useRef<HTMLDivElement>(null);
  const active = useCallback(() => alive.current && buyerMode() === "personal" && personalSessionStore.getSnapshot().session?.sessionId === session.sessionId, [session.sessionId]);
  const load = useCallback(async (keepError = false) => {
    const generation = ++revision.current;
    if (!keepError) setError(null);
    try {
      const value = await api.personalCurrentCart();
      if (!active() || revision.current !== generation) return;
      setCart(value); setChecked(null);
      const validation = value?.items.length ? await api.personalValidateCart(value.id) : null;
      if (!active() || revision.current !== generation) return;
      setChecked(validation); setNeedsCheck(false);
    } catch {
      if (active() && revision.current === generation) { setError(t.failed); setNeedsCheck(true); }
    } finally { if (active() && revision.current === generation) setLoading(false); }
  }, [api, active, t.failed]);
  useEffect(() => {
    alive.current = true; void load();
    const refresh = () => { if (!lock.current && document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    return () => { alive.current = false; revision.current++; window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); };
  }, [load]);
  const discard = (id: string) => setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
  const run = async (mutation: () => Promise<PersonalCart>, itemId?: string, removed = false) => {
    if (lock.current || !active()) return;
    lock.current = true; revision.current++; setBusy(true); setError(null); setNotice(false);
    try {
      const value = await mutation();
      if (!active()) return;
      setCart(value); setChecked(null); setNotice(true);
      if (itemId) discard(itemId);
      if (removed) window.requestAnimationFrame(() => heading.current?.focus());
      try {
        const validation = value.items.length ? await api.personalValidateCart(value.id) : null;
        if (active()) { setChecked(validation); setNeedsCheck(false); }
      } catch { if (active()) { setError(t.failed); setNeedsCheck(true); } }
    } catch (cause) {
      if (!active()) return;
      const conflict = cause instanceof MarketplaceApiError && cause.status === 409;
      setError(conflict ? t.conflict : t.unknown); setNeedsCheck(true);
      if (conflict) await load(true);
    } finally { if (active()) { lock.current = false; setBusy(false); } }
  };
  if (loading) return <LoadingState label={t.loading} />;
  const validation = checked?.cartId === cart?.id && checked?.cartVersion === cart?.version ? checked : null;
  return <div className={styles.rows} ref={heading} tabIndex={-1}>
    {error ? <DmFeedback presentation="note" tone="danger" alert title={t.error} description={error}
      action={<DmButton disabled={busy} onClick={() => void load()}>{t.retry}</DmButton>} /> : null}
    {notice ? <ActionFeedback tone="success" description={t.saved} /> : null}
    {Object.entries(drafts).filter(([id]) => cart && !cart.items.some(item => item.id === id)).map(([id, value]) => <DmFeedback key={id} presentation="note" tone="warning"
      title={t.removedDraft} description={value} action={<DmButton onClick={() => discard(id)}>{t.discard}</DmButton>} />)}
    {!cart?.items.length ? !error ? <Section><EmptyState title={t.empty} description={t.emptyText} action={<DmButton as="a" href="/catalog" appearance="primary">{t.catalog}</DmButton>} /></Section> : null : <>
      {cart.items.map(item => <PersonalCartItem key={item.id} item={item} checked={validation?.items.find(value => value.cartItemId === item.id)}
        draft={drafts[item.id]} busy={busy || needsCheck} t={t} onDraft={value => setDrafts(previous => ({ ...previous, [item.id]: value }))}
        onSave={() => void run(() => api.personalUpdateItem(cart.id, item.id, { expectedVersion: cart.version, quantity: Number(drafts[item.id] ?? item.snapshot.quantity) }), item.id)}
        onRemove={() => void run(() => api.personalRemoveItem(cart.id, item.id, { expectedVersion: cart.version }), item.id, true)}
        onAccept={() => {
          const current = validation?.items.find(value => value.cartItemId === item.id)?.current;
          if (current) void run(() => api.personalRepriceCart(cart.id, { expectedVersion: cart.version, acceptedItems: [{ cartItemId: item.id, snapshot: current }] }));
        }} />)}
      <Section><div className={styles.summary}><span>{t.total}</span><strong className={styles.amount}>{formatMoney(cart.totalAmountMinor, cart.currency)}</strong></div></Section>
    </>}
  </div>;
}

export default function PersonalCartPage() {
  const personal = usePersonalSession(); const mode = useBuyerMode();
  const router = useRouter(); const search = useSearchParams();
  const locale = search.get("lang") === "kk" ? "kk" : "ru";
  const t = personalCartCopy[locale];
  useEffect(() => { setBuyerMode("personal"); }, []);
  const login = new URL(loginUrl, "http://local.invalid"); login.searchParams.set("personal", "1");
  const loginHref = loginUrl.startsWith("/") ? login.pathname + login.search : login.href;
  return <><MarketplaceHeader showCity={false} /><main className={styles.page} lang={locale}>
    <PageHeader title={t.title} actions={<div className={styles.actions}>
      <div className={styles.language}><DmField label={t.language}><DmDropdown aria-label={t.language} value={locale} onChange={(_, data) => router.replace(`/personal/cart?lang=${data.value === "kk" ? "kk" : "ru"}`)}>
        <option value="ru">Русский</option><option value="kk">Қазақша</option>
      </DmDropdown></DmField></div><DmButton as="a" href="/catalog">{t.catalog}</DmButton>
    </div>} />
    <DmFeedback presentation="note" tone="info" title={t.scopeTitle} description={t.scope} />
    {!personal.ready || mode !== "personal" ? <LoadingState label={t.loading} /> : personal.session ? <>
      <p className={styles.text}>{t.buyer}: {personal.session.user.displayName}</p>
      <CartContents key={personal.session.sessionId} session={personal.session} t={t} />
    </> : personal.error ? <ErrorState presentation="inline" title={t.error} description={t.failed}
      action={<DmButton onClick={() => void personalSessionStore.retry()}>{t.retry}</DmButton>} /> : <Section><EmptyState title={t.loginTitle} description={t.loginText}
      action={<DmButton as="a" href={loginHref} appearance="primary">{t.login}</DmButton>} /></Section>}
  </main></>;
}
