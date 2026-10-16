import type { MouseEvent } from "react";
import { workspacePath } from "@marketplace/api-client";
import { serializeAdminQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
export const orderHref = (state: AdminQuery) => workspacePath("ADMIN", "/") + serializeAdminQuery(state);
export function orderNavigate(event: MouseEvent, state: AdminQuery, write: (state: AdminQuery) => void) {
  if (!event.button && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); write(state); }
}
