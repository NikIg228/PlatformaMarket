"use client";
import { useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { CartResponse } from "@marketplace/schemas";
import { DmButton, Section, errorMessage } from "@marketplace/ui";

export function CartRecovery({ api, carts, hasCurrentItems, onRecovered }: {
  api: MarketplaceApiClient; carts: CartResponse[]; hasCurrentItems: boolean; onRecovered: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const recover = async (cart: CartResponse) => {
    if (lock.current) return;
    lock.current = true; setBusy(cart.id); setError(""); setNotice("");
    try {
      const result = await api.recoverCart(cart.id, { expectedVersion: cart.version });
      setNotice(result.status === "ACTIVE" ? "Состав восстановлен. Проверьте доступность и примите изменившиеся условия перед оформлением." : "Эта корзина уже восстанавливалась и оформлена. Проверьте список заказов.");
      await onRecovered();
    } catch (cause) { setError(`${errorMessage(cause)} Повтор восстановления не создаст вторую корзину.`); }
    finally { lock.current = false; setBusy(null); }
  };
  const failed = carts.filter(cart => cart.status === "ABANDONED" && cart.checkout?.status === "FAILED" && !cart.recoveredCartId);
  if (!failed.length && !notice && !error) return null;
  return <Section title="Восстановление после неудачного оформления">
    {error ? <p role="alert">{error}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {hasCurrentItems && failed.length ? <p>Сначала завершите работу с текущей корзиной. Её товары сохраняются отдельно.</p> : null}
    {failed.map(cart => <section key={cart.id} aria-label="Неудачное оформление">
      <p>Товар не удалось зарезервировать. Предыдущая попытка сохранена в истории.</p>
      <ul>{cart.items.map(item => <li key={item.id}>{item.offer?.productVariant?.product.canonicalName ?? "Товар"} — {item.quantity}</li>)}</ul>
      <p>Восстановление вернёт все позиции в новую корзину. Недоступные товары будут показаны, цены и остатки проверятся заново.</p>
      <DmButton appearance="primary" disabled={Boolean(busy) || hasCurrentItems} onClick={() => void recover(cart)}>
        {busy === cart.id ? "Восстанавливаем…" : "Восстановить состав корзины"}
      </DmButton>
    </section>)}
  </Section>;
}
