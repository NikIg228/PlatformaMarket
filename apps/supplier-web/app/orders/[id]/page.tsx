"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { OrderWorkflowWorkspace, LoadingState, ErrorState, DmButton } from "@marketplace/ui";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import { useVerifiedSession, sessionApiContext, sessionStore } from "../../workspace-session";
import { loginUrl } from "../../public-links";
import { ShipmentPanel, type ShipmentOrder } from "../../shipment-panel";
export default function OrderPage() {
 const params = useParams<{id:string}>();
 const {session,ready,error}=useVerifiedSession();
 const api=useMemo(()=>new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api",sessionApiContext),[]);
 if(!ready)return <LoadingState label="Проверяем вход"/>;
 if(!session?.organizationId)return <ErrorState title="Войдите в кабинет" description={error ?? "Этапы заказа доступны участникам сделки."} action={<><DmButton as="a" href={withWorkspaceReturn(loginUrl,workspacePath("SUPPLIER","/orders/"+params.id))}>Войти</DmButton><DmButton onClick={()=>void sessionStore.retry()}>Повторить</DmButton></>}/>;
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"var(--dm-space-6)"}}><OrderWorkflowWorkspace key={session.organizationId+params.id} orderId={params.id} organizationId={session.organizationId} api={api} onDownload={async id=>{const {blob,fileName}=await api.downloadDocument(id);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName ?? "document.pdf";a.click();URL.revokeObjectURL(url);}} renderFulfillment={(data,refresh)=><ShipmentPanel order={data.order as ShipmentOrder} api={api} onChanged={refresh}/>}/></main>;
}
