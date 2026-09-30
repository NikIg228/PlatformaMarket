import { NextRequest } from "next/server";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
export function GET(request: NextRequest) {
  return new Response(null, { status: 307, headers: { Location: withWorkspaceReturn("/login", request.nextUrl.pathname) } });
}
