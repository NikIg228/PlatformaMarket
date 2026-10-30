import { publicFrontendUrls, publicLoginUrl } from "@marketplace/api-client/frontend-routes";
export const loginUrl = publicLoginUrl;
export const publicCatalogUrl = `${publicFrontendUrls.buyer.replace(/\/$/, "")}/catalog`;
