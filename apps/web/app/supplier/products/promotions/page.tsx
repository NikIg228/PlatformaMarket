"use client";
import Link from "next/link";
import { frontendFeatures } from "@marketplace/api-client";
import { PromotionWorkspace } from "@marketplace/ui/promotions";
import { PermissionBoundary } from "../../../workspaces/permission-boundary";
import { useWorkspace } from "../../../workspaces/workspace";
import styles from "../../../workspaces/workspace.module.css";
export default function PromotionsPage() {
  if (!frontendFeatures.promotions) return <p>Акции недоступны в текущем профиле.</p>;
  return <div className={styles.stack}><Link href="/supplier/products">← Все товары</Link><PermissionBoundary required={["promotion.view", "promotion.manage"]}><Promotions /></PermissionBoundary></div>;
}
function Promotions() {
  const { api } = useWorkspace();
  return <PromotionWorkspace api={api} hideHeading />;
}
