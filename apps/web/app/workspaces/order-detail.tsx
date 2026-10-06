"use client";
import { useParams } from "next/navigation";
import { DmButton, OrderWorkflowWorkspace, PermissionFields } from "@marketplace/ui";
import { OrderConfirmationPanel } from "../../../supplier-web/app/order-confirmation-panel";
import {
  ShipmentPanel,
  type ShipmentOrder,
} from "../../../supplier-web/app/shipment-panel";
import { useWorkspace } from "./workspace";
import styles from "./workspace.module.css";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { api, role, organizationId } = useWorkspace();
  return (
    <div id={`supplier-order-${id}`} tabIndex={-1} className={`${styles.stack} ${styles.order}`}>
      <OrderWorkflowWorkspace hideHeading
        conversation={<PermissionFields required={["support.ticket.view"]}><DmButton as="a" href={`/${role}/messages?contextType=ORDER&contextId=${id}`}>Переписка по заказу</DmButton></PermissionFields>}
        backHref={`/${role}/orders`}
        backLabel="← Все заказы"
        cartHref="/clinic/cart"
        key={`${organizationId}:${id}`}
        orderId={id}
        organizationId={organizationId}
        api={api}
        onDownload={async (documentId) => {
          const result = await api.downloadDocument(documentId);
          const url = URL.createObjectURL(result.blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = result.fileName ?? "document.pdf";
          anchor.click();
          URL.revokeObjectURL(url);
        }}
        renderConfirmation={role === "supplier" ? (data, refresh) => (<OrderConfirmationPanel
                      available={data.order.status === "AWAITING_CONFIRMATION"}
                      order={{
                        ...data.order,
                        items: data.order.items.map((item) => ({
                          ...item,
                          offer: item.offer ?? {
                            productVariant: {
                              product: { canonicalName: "Товар" },
                            },
                          },
                        })),
                      }}
                      onConfirm={async (decisions) => {
                        try {
                          await api.confirmSupplierOrder(data.order.id, {
                            decisions,
                          });
                          await refresh();
                          return null;
                        } catch (cause) {
                          return cause instanceof Error
                            ? cause.message
                            : "Не удалось подтвердить заказ";
                        }
                      }}
                    />) : undefined}
        renderFulfillment={
          role === "supplier"
            ? (data, refresh) => (
                <>
                  <PermissionFields required={["shipment.manage"]}><ShipmentPanel
                    order={
                      {
                        ...data.order,
                        buyer: data.order.buyer ?? { displayName: "Клиника" },
                        items: data.order.items.map((item) => ({
                          ...item,
                          offer: item.offer ?? {
                            productVariant: {
                              product: { canonicalName: "Товар" },
                            },
                          },
                        })),
                      } as ShipmentOrder
                    }
                    api={api}
                    onChanged={refresh}
                  />
                  </PermissionFields>
                </>
              )
            : undefined
        }
      />
    </div>
  );
}
