import { publicFrontendUrls, publicLoginUrl } from "@marketplace/api-client/frontend-routes";
import { withProductReturn } from "@marketplace/schemas/product-navigation";
export const landingAppUrl = publicFrontendUrls.landing;
export const supplierAppUrl = publicFrontendUrls.supplier;
export const loginUrl = publicLoginUrl;
export const productLoginUrl = (returnTo: string) => withProductReturn(loginUrl, returnTo);
export const registrationUrl = (role: "buyer" | "supplier") => `${landingAppUrl}/register?role=${role}`;
