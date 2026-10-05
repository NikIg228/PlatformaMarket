"use client";
import { frontendFeatures } from "@marketplace/api-client";
import { PermissionBoundary } from "../../../workspaces/permission-boundary";
export default function PromotionsPage() {
  if (!frontendFeatures.promotions) return <p>Акции недоступны в текущем профиле.</p>;
  return <PermissionBoundary required={["promotion.view", "promotion.manage"]}>{null}</PermissionBoundary>;
}
