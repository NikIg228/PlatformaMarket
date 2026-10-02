"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DmButton, ErrorState, LoadingState, PermissionFields } from "@marketplace/ui";
import { BuyerCart } from "../../../buyer-web/app/features/purchasing/buyer-cart";
import type {
  Cart as CartValue,
  CartValidation,
} from "../../../buyer-web/app/features/purchasing/types";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { MarketplaceApiError } from "@marketplace/api-client";
import type { CartResponse } from "@marketplace/schemas";
import { CartRecovery } from "./cart-recovery";
import { PageNavigation, usePageNavigation } from "./page-navigation";

export default function Cart() {
  const { api, organizationId } = useWorkspace();
  const router = useRouter();
  const [validation, setValidation] = useState<CartValidation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const navigation = usePageNavigation();
  const load = useCallback(async (): Promise<{
    cart: CartValue | null;
    checked: CartValidation | null;
    carts: CartResponse[];
    nextCursor: string | null;
    cursor: string | undefined;
  }> => {
    const result = await api.workspaceCarts({ cursor: navigation.cursor, limit: 25 });
    const cart = result.current;
    const checked = cart?.items.length ? await api.validateCart(cart.id) : null;
    return { cart, checked, carts: result.items, nextCursor: result.nextCursor, cursor: navigation.cursor };
  }, [api, organizationId, navigation.cursor]);
  // Recovery-page navigation must not unmount the current cart's quantity drafts.
  // Workspace identity changes remount this subtree at the provider boundary.
  const resource = useResource(load, { automatic: false, retainDataOnChange: true });
  const cart = resource.data?.cart ?? null;
  const checked =
    validation?.cartId === cart?.id && validation?.cartVersion === cart?.version
      ? validation
      : (resource.data?.checked ?? null);
  const perform = async (action: "reprice" | "checkout") => {
    if (!cart || lock.current) return;
    lock.current = true;
    setBusy(action);
    setError(null);
    try {
      if (action === "reprice") {
        await api.repriceCart(cart.id, {
          expectedVersion: checked?.cartVersion ?? cart.version,
          acceptedItems: checked?.items.flatMap(item => item.current ? [{ cartItemId: item.cartItemId, snapshot: item.current }] : []),
        });
        setValidation(null);
        await resource.refresh();
      } else {
        if (
          !checked?.canCheckout ||
          checked.requiresAcceptance ||
          checked.cartVersion !== cart.version
        )
          throw new Error(
            "Обновите корзину и примите изменения перед оформлением.",
          );
        await api.checkoutCart(cart.id, {
          expectedVersion: checked.cartVersion,
          idempotencyKey: `buyer-ui-${cart.id}`,
        });
        router.push("/clinic/orders");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Действие не выполнено. Повторите попытку.",
      );
      if (cause instanceof MarketplaceApiError && cause.status === 409) {
        setValidation(null);
        await resource.refresh();
      }
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  if (resource.error && !resource.data)
    return (
      <ErrorState
        title="Не удалось загрузить корзину"
        description={resource.error}
        action={
          <DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>
        }
      />
    );
  if (!resource.data)
    return <LoadingState label="Загружаем и проверяем корзину" />;
  return (
    <>
      <ResourceStatus resource={resource} />
      {resource.error ? <DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Повторить загрузку истории</DmButton> : null}
      {error ? <p role="alert">{error}</p> : null}
      <PermissionFields required={["order.create"]}>
      <CartRecovery api={api} carts={resource.data.cursor === navigation.cursor ? resource.data.carts : []} hasCurrentItems={Boolean(cart?.items.length)} onRecovered={async () => {
        setValidation(null); setError(null); await resource.refresh();
      }} />
      <PageNavigation navigation={navigation} nextCursor={resource.data.cursor === navigation.cursor ? resource.data.nextCursor : null} loading={resource.loading} onRefresh={() => { navigation.reset(); if (!navigation.cursor) void resource.refresh(); }} />
      <BuyerCart
        hideHeading
        api={api}
        cart={cart}
        validation={checked}
        validationLoading={resource.loading}
        busy={busy}
        onCartChanged={(next) => {
          setValidation(null);
          resource.setData({ cart: next, checked: null, carts: resource.data?.carts ?? [], nextCursor: resource.data?.nextCursor ?? null, cursor: resource.data?.cursor });
        }}
        onValidated={setValidation}
        onRefresh={() => {
          setValidation(null);
          void resource.refresh();
        }}
        onBrowseCatalog={() => router.push("/catalog")}
        onAcceptChanges={() => void perform("reprice")}
        onCheckout={() => void perform("checkout")}
      />
      </PermissionFields>
    </>
  );
}
