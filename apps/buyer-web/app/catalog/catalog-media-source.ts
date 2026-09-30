import type { SearchMedia } from "../catalog-search-types";

const rejected = /(logo|favicon|icon|sprite|avatar|cart|basket|loading|pixel|captcha|phone[-_]?ico|placeholder|no[-_]?image|default[-_]?image|\/(?:themes?|templates?|assets\/icons?|images?\/icons?)\/)/i;
export function catalogMediaSource(media?: SearchMedia): string | null {
  if (!media || media.metadata?.exactProductPhoto !== true ||
    rejected.test(media.metadata.sourceImageUrl ?? media.sourceUrl ?? media.securePath ?? "")) return null;
  if (media.securePath?.startsWith("/catalog/products/")) return media.securePath;
  if (media.securePath) return `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api"}${media.securePath}`;
  return media.sourceUrl;
}
