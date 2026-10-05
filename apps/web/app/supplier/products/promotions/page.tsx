"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { frontendFeatures } from "@marketplace/api-client";
import { PromotionWorkspace } from "@marketplace/ui/promotions";
import { PermissionBoundary } from "../../../workspaces/permission-boundary";
import { useWorkspace } from "../../../workspaces/workspace";
import styles from "../../../workspaces/workspace.module.css";
export default function PromotionsPage() {
  if (!frontendFeatures.promotions) return <p>Акции недоступны в текущем профиле.</p>;
  return <div className={styles.stack}><PermissionBoundary required={["promotion.view", "promotion.manage"]}><Promotions /></PermissionBoundary></div>;
}
function Promotions() {
  const { api } = useWorkspace();
  const query = useSearchParams(), router = useRouter();
  return <PromotionWorkspace api={api} hideHeading createMode={query.get("mode") === "new"} initialOfferId={query.get("offer") ?? undefined} onModeChange={create => router.replace(`/supplier/products/promotions${create ? "?mode=new" : ""}`)} />;
}
