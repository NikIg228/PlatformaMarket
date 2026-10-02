"use client";
import Link from "next/link";
import { frontendFeatures } from "@marketplace/api-client";
import { PromotionWorkspace } from "@marketplace/ui/promotions";
import { useWorkspace } from "../../../workspaces/workspace";
import { PermissionBoundary } from "../../../workspaces/permission-boundary";
export default function PromotionsPage() {
  const { api } = useWorkspace();
  if (!frontendFeatures.promotions) return <p>Акции недоступны в текущем профиле.</p>;
  return <div className="mp-stack"><Link href="/supplier/products">← Все товары</Link><PermissionBoundary required={["promotion.view", "promotion.manage"]}><PromotionWorkspace hideHeading api={api} /></PermissionBoundary></div>;
}
