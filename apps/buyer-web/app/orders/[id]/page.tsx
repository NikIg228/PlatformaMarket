"use client";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { MarketplaceApiClient, workspacePath } from "@marketplace/api-client";
import { OrderWorkflowWorkspace, LoadingState } from "@marketplace/ui";
import { SessionRequired } from "@marketplace/ui/session-required";
import { useVerifiedSession, sessionApiContext, sessionStore } from "../../workspace-session";
import { loginUrl } from "../../public-links";

export default function OrderPage() {
 const params = useParams<{id:string}>();
 const {session,ready,error,termination}=useVerifiedSession();
 const api=useMemo(()=>new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api",sessionApiContext),[]);
 if(!ready)return <LoadingState label="Загружаем кабинет…"/>;
 if(!session?.organizationId)return <SessionRequired error={error} termination={termination} loginUrl={loginUrl} returnTo={workspacePath("BUYER","/orders/"+params.id)} retry={()=>void sessionStore.retry()}/>;
 return <main style={{maxWidth:1100,margin:"0 auto",padding:"var(--dm-space-6)"}}><OrderWorkflowWorkspace key={session.organizationId+params.id} orderId={params.id} organizationId={session.organizationId} api={api} onDownload={async id=>{const {blob,fileName}=await api.downloadDocument(id);const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName ?? "document.pdf";a.click();URL.revokeObjectURL(url);}} /></main>;
}
