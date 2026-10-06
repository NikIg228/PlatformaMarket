"use client";
import { DmSelect } from "@marketplace/ui/controls";
import { workspacePath } from "@marketplace/api-client";
import { catalogMediaSource as mediaSource } from "./catalog/catalog-media-source";
import { catalogPriceToMinor } from "./catalog/catalog-view-model";
import { CompactCatalog } from "./features/catalog/compact-catalog";
import { useVerifiedSession, sessionApiContext, logoutSession } from "./workspace-session";

import dynamic from "next/dynamic";
import Link from "next/link";
import { appendCatalogPage, fetchLiveCatalog, loadCatalogWindow } from "./catalog/live-search";
import { readMarketplaceCatalog, marketplaceCatalogUrl } from "./catalog/marketplace-url";

import { Spinner } from "@fluentui/react-components";
import { DmButton as Button, DmCheckbox as Checkbox, DmField as Field, DmInput as Input, DmSelect as Select } from "@marketplace/ui/controls";
import { Alert24Regular } from "@fluentui/react-icons/svg/alert";
import { ArrowSync24Regular } from "@fluentui/react-icons/svg/arrow-sync";
import { Cart24Regular } from "@fluentui/react-icons/svg/cart";
import { ClipboardTaskListLtr24Regular } from "@fluentui/react-icons/svg/clipboard-task-list-ltr";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { Document24Regular } from "@fluentui/react-icons/svg/document";
import { Filter24Regular } from "@fluentui/react-icons/svg/filter";
import { Grid24Regular } from "@fluentui/react-icons/svg/grid";
import { List24Regular } from "@fluentui/react-icons/svg/list";
import { Search24Regular } from "@fluentui/react-icons/svg/search";
import { ShoppingBag24Regular } from "@fluentui/react-icons/svg/shopping-bag";
import { Star16Filled } from "@fluentui/react-icons/svg/star";
import {
  MarketplaceApiClient,
  frontendFeatures,
  parseSessionHandoff,
  revokeWorkspaceSession,
  type ApiContext,
  type SessionHandoffEnvelope,
} from "@marketplace/api-client";
import {
  AppShell,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Section,
  StatusTag,
  useSessionLogout,
  errorMessage,
  formatDate,
  formatMoney,
  formatStatus,
  type NavigationItem,
} from "@marketplace/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./page.module.css";
import { BuyerServicesPanel } from "./buyer-services-panel";
import { BuyerServicesMenu } from "./buyer-services-menu";
import { BuyerOrders } from "./features/purchasing/buyer-orders";
import type {
  Cart,
  CartValidation,
  ReviewDraft,
  SupplierOrder,
} from "./features/purchasing/types";
import { SmartCommercePanel } from "./smart-commerce-panel";
import { loginUrl } from "./public-links";
import { MarketplaceHeader } from "./features/marketplace-header/marketplace-header";
import { useDeliveryContext } from "./features/marketplace-header/delivery-context";
import { canonicalSearchQuery } from "./catalog-search";
import { formatCatalogMoney } from "./catalog/catalog-view-model";
import { OfferDeliverySummary, type DeliverySummary } from "./catalog/offer-delivery-summary";
import type {
  ProductVariantOption,
  SearchMedia,
  SearchProduct,
  SearchResult,
} from "./catalog-search-types";
import {
  deliveryLabel,
  isCompareOfferAvailable,
  rankCompareOffers,
  rankSearchOffers,
} from "./catalog-ranking";

// Keep cart validation in the cart chunk; opening the catalog must not eagerly
// download the CommonJS schema graph. Validation itself remains unchanged.
const BuyerCart = dynamic(
  () => import("./features/purchasing/buyer-cart").then((module) => module.BuyerCart),
  { loading: () => <LoadingState label="Загружаем корзину" /> },
);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
type SessionHandoff = SessionHandoffEnvelope;
const SESSION_KEY = "dentmarket:buyer-session";
const LOGIN_URL = loginUrl;
const CATALOG_PAGE_SIZE = 24;
const dentalSearchSuggestions = [
  "светник",
  "текучка",
  "коффер",
  "эндошка",
  "гутта",
  "карпулы",
];
const ruCount = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};


const bestPromotionPercent = (product: SearchProduct) =>
  frontendFeatures.promotions ? product.offers.reduce(
    (best, offer) => Math.max(best, offer.promotion?.percentage ?? 0),
    0,
  ) : 0;
const priceDifferencePercent = (product: SearchProduct) => {
  const prices = product.offers
    .map((offer) => Number(offer.priceMinor ?? 0))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((left, right) => left - right);
  if (prices.length < 2 || prices[0] === prices.at(-1)) return 0;
  return Math.round((1 - prices[0] / prices.at(-1)!) * 100);
};
type CompareOffer = {
  offerId: string;
  variantId: string;
  supplier: { organizationId: string; name: string };
  supplierSku: string | null;
  price: {
    amountMinor: string;
    currency: string;
    normalizedPriceMinor: string;
    normalizedUnit: string;
  };
  packaging: { name: string; quantityInBaseUnit: string; unit: string | null };
  availability: Array<{
    warehouse: string;
    quantityAvailable: string;
    updatedAt: string | null;
  }>;
  delivery: DeliverySummary[];
  markers: {
    verifiedDocuments: boolean;
    complianceRisk: string | null;
    officialDistributor: boolean;
    supplierWarranty: boolean;
    requiresConfirmation: boolean;
  };
};
type Comparison = {
  product: {
    id: string;
    name: string;
    brand: string | null;
    manufacturer: string | null;
  };
  variants?: ProductVariantOption[];
  selectedVariantId?: string | null;
  offers: CompareOffer[];
  reviewSummary?: { count: number; averageRating: number | null };
  comparisonAttributes: Array<{ code: string; name: string; value: unknown }>;
};
type SupplierTrust = {
  status: string;
  score: string | null;
  reviewCount?: number;
  eventCount?: number;
};
type ProductReviews = {
  summary: { count: number; averageRating: number | null };
  reviews: Array<{
    id: string;
    overallRating: number;
    comment: string | null;
    officialResponse: string | null;
    createdAt: string;
  }>;
};
type DocumentRecord = {
  id: string;
  title: string;
  documentNumber: string | null;
  kind: string;
  format: string;
  status: string;
  createdAt: string;
  signatures: Array<{ id: string; status: string }>;
};
type NotificationRecord = {
  id: string;
  subject: string;
  body: string;
  eventType: string;
  priority: string;
  status: string;
  readAt: string | null;
  createdAt: string;
};

const navigation: NavigationItem[] = [
  { id: "catalog", label: "Каталог", icon: <Grid24Regular /> },
  { id: "cart", label: "Корзина", icon: <Cart24Regular /> },
  { id: "orders", label: "Заказы", icon: <ClipboardTaskListLtr24Regular /> },
  { id: "documents", label: "Документы", icon: <Document24Regular /> },
  { id: "workspace", label: "Списки и бюджеты", icon: <List24Regular /> },
  { id: "notifications", label: "Уведомления", icon: <Alert24Regular /> },
];

const statusTone = (
  status: string,
): "success" | "warning" | "danger" | "info" | "neutral" => {
  if (
    [
      "COMPLETED",
      "CONFIRMED",
      "SIGNED",
      "SENT",
      "GENERATED",
      "DELIVERED",
    ].includes(status)
  )
    return "success";
  if (["FAILED", "REJECTED", "CANCELLED", "DEAD", "EXPIRED"].includes(status))
    return "danger";
  if (
    [
      "AWAITING_CONFIRMATION",
      "PENDING",
      "AWAITING_SIGNATURE",
      "PARTIALLY_SIGNED",
    ].includes(status)
  )
    return "warning";
  return "info";
};

type BuyerWorkspaceProps = {
  searchParams: Promise<{ q?: string; offset?: string }>;
  publicCatalog?: boolean;
};

export default function BuyerWorkspace({
  searchParams: _searchParams,
  publicCatalog = false,
}: BuyerWorkspaceProps) {
  // URL state is applied in an effect after hydration. Keeping the client
  // component's first render deterministic prevents Safari from leaving the
  // server markup interactive-looking but without event handlers.
  const initialQuery = "";
  const { session: verifiedSession, ready: handoffChecked, error: sessionError } = useVerifiedSession();
  const handoff = publicCatalog ? null : verifiedSession;
  const buyerId = handoff?.organizationId ?? "";
  const apiContext = sessionApiContext;
  const api = useMemo(() => new MarketplaceApiClient(API_URL, apiContext), [apiContext]);
  const separateCatalog = process.env.NEXT_PUBLIC_UNIFIED_APP === "true" && !publicCatalog;
  const [active, setActive] = useState(separateCatalog ? "cart" : "catalog");
  const deliveryContext = useDeliveryContext();
  const [deliveryUrl, setDeliveryUrl] = useState({ deliveryCityId: "", inCity: false });
  const cityFilter = deliveryContext.inCity ? deliveryContext.city?.id : undefined;
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState("RELEVANCE");
  const [unitFilter, setUnitFilter] = useState("");
  const [packagingFilter, setPackagingFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categoryIdFilter, setCategoryIdFilter] = useState("");
  const [serverFilters, setServerFilters] = useState({ brandId: "", manufacturerId: "", supplierOrganizationId: "", attributeFilters: "" });
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [officialOnly, setOfficialOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState<SearchResult | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [catalogUrlReady, setCatalogUrlReady] = useState(false);
  const [catalogHistoryRevision, setCatalogHistoryRevision] = useState(0);
  const catalogPath = useRef("/");
  const restoredCount = useRef(CATALOG_PAGE_SIZE);
  const searchRequest = useRef<AbortController | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SearchProduct | null>(
    null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [productReviews, setProductReviews] = useState<ProductReviews | null>(
    null,
  );
  const [supplierTrust, setSupplierTrust] = useState<
    Record<string, SupplierTrust>
  >({});
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartValidation, setCartValidation] = useState<CartValidation | null>(
    null,
  );
  const [cartValidationLoading, setCartValidationLoading] = useState(false);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>(
    {},
  );
  const [submittedReviews, setSubmittedReviews] = useState<string[]>([]);


  const activeCart = carts.find((cart) => cart.status === "ACTIVE") ?? null;
  const buyerOrders = orders.filter(
    (order) => order.buyerOrganizationId === buyerId,
  );
  const unread = notifications.filter((item) => !item.readAt).length;
  const rankedComparisonOffers = useMemo(
    () => rankCompareOffers(comparison?.offers ?? [], frontendFeatures.trust ? supplierTrust : {}),
    [comparison, supplierTrust],
  );

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

  const buildSearchParams = useCallback(
    (nextQuery = query, nextSort = sort) => {
      const params = new URLSearchParams({
        buyerOrganizationId: buyerId,
        q: canonicalSearchQuery(nextQuery),
        sort: nextSort,
        limit: "24",
      });
      if (stockFilter !== "all") params.set("inStock", stockFilter);
      if (cityFilter) params.set("cityId", cityFilter);
      if (categoryIdFilter) params.set("categoryId", categoryIdFilter);
      if (unitFilter) params.set("unit", unitFilter);
      if (packagingFilter) params.set("packaging", packagingFilter);
      if (deliveryFilter) params.set("deliveryMethod", deliveryFilter);
      if (brandFilter) params.set("brandName", brandFilter); if (categoryFilter) params.set("categoryName", categoryFilter);
      params.set("priceBasis", "SALE_UNIT"); params.set("includeFilterOptions", "true");
      for (const [key, value] of Object.entries(serverFilters)) if (value) params.set(key, value);
      const min = catalogPriceToMinor(minPriceFilter), max = catalogPriceToMinor(maxPriceFilter);
      if (min) params.set("minSalePriceMinor", min); if (max) params.set("maxSalePriceMinor", max);
      return params;
    },
    [
      buyerId,
      cityFilter,
      serverFilters, minPriceFilter, maxPriceFilter, brandFilter, categoryFilter,
      categoryIdFilter,
      deliveryFilter,
      packagingFilter,
      query,
      sort,
      stockFilter,
      unitFilter,
    ],
  );

  const buildPublicSearchParams = useCallback(
    (
      nextQuery = query,
      nextSort = sort,
      limit = CATALOG_PAGE_SIZE,
      offset?: number,
    ) => {
      const params = new URLSearchParams({
        q: canonicalSearchQuery(nextQuery),
        sort: nextSort,
        limit: String(limit),
      });
      if (offset) params.set("offset", String(offset));
      if (cityFilter) params.set("cityId", cityFilter);
      if (stockFilter !== "all") params.set("inStock", stockFilter);
      if (categoryIdFilter) params.set("categoryId", categoryIdFilter);
      if (unitFilter) params.set("unit", unitFilter);
      if (packagingFilter) params.set("packaging", packagingFilter);
      if (deliveryFilter) params.set("deliveryMethod", deliveryFilter);
      if (brandFilter) params.set("brandName", brandFilter); if (categoryFilter) params.set("categoryName", categoryFilter);
      params.set("priceBasis", "SALE_UNIT"); params.set("includeFilterOptions", "true");
      for (const [key, value] of Object.entries(serverFilters)) if (value) params.set(key, value);
      const min = catalogPriceToMinor(minPriceFilter), max = catalogPriceToMinor(maxPriceFilter);
      if (min) params.set("minSalePriceMinor", min); if (max) params.set("maxSalePriceMinor", max);
      return params;
    },
    [
      cityFilter,
      serverFilters, minPriceFilter, maxPriceFilter, brandFilter, categoryFilter,
      categoryIdFilter,
      deliveryFilter,
      packagingFilter,
      query,
      sort,
      stockFilter,
      unitFilter,
    ],
  );

  const loadSearch = useCallback(async (nextQuery = query, nextSort = sort, limit = CATALOG_PAGE_SIZE) => {
    searchRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    setLoading(true);
    try {
      const result = await loadCatalogWindow<SearchResult>(async (offset, pageSize) => {
        const params = handoff ? buildSearchParams(nextQuery, nextSort) : buildPublicSearchParams(nextQuery, nextSort);
        params.set("offset", String(offset)); params.set("limit", String(pageSize));
        return handoff ? api.request<SearchResult>("/marketplace/search?" + params, { signal: controller.signal })
          : fetchLiveCatalog<SearchResult>(params, controller.signal);
      }, limit);
      if (!controller.signal.aborted) { setSearch(result); setError(null); }
    } catch (cause) {
      if (!controller.signal.aborted) { setSearch(null); throw cause; }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [api, buildPublicSearchParams, buildSearchParams, handoff, query, sort]);
  useEffect(() => () => searchRequest.current?.abort(), []);
  const requestCartValidation = useCallback(
    async (cart: Cart | null) => {
      if (!cart?.items.length) {
        setCartValidation(null);
        return null;
      }
      setCartValidationLoading(true);
      try {
        const result = await api.post<CartValidation>(
          `/carts/${cart.id}/validate`,
        );
        setCartValidation(result);
        return result;
      } finally {
        setCartValidationLoading(false);
      }
    },
    [api],
  );

  const refresh = useCallback(async () => {
    if (!handoffChecked) return;
    setLoading(true);
    setError(null);
    try {
      if (!handoff) {
        await loadSearch(query, sort, restoredCount.current);
        setCarts([]);
        setCartValidation(null);
        setOrders([]);
        setDocuments([]);
        setNotifications([]);
        return;
      }
      const [
        _searchResult,
        cartResult,
        orderResult,
        documentResult,
        notificationResult,
      ] = await Promise.all([
        separateCatalog ? Promise.resolve() : loadSearch(query, sort, restoredCount.current),
        api.get<Cart[]>(`/buyers/${buyerId}/carts`),
        api.get<SupplierOrder[]>(`/buyers/${buyerId}/orders`),
        api.get<DocumentRecord[]>(
          "/documents?limit=100",
        ),
        api.get<NotificationRecord[]>(
          `/notifications/organizations/${buyerId}?limit=100`,
        ),
      ]);
      setCarts(cartResult);
      await requestCartValidation(
        cartResult.find((cart) => cart.status === "ACTIVE") ?? null,
      );
      setOrders(orderResult);
      setDocuments(documentResult);
      setNotifications(notificationResult);
    } catch (cause) {
      setSearch(null);
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [
    api,
    buildPublicSearchParams,
    buildSearchParams,
    buyerId,
    handoff,
    handoffChecked,
    loadSearch,
    query,
    requestCartValidation,
    sort,
    separateCatalog,
  ]);

  useEffect(() => {
    const restore = () => {
    const state = readMarketplaceCatalog(new URLSearchParams(window.location.search));
    catalogPath.current = window.location.pathname;
    setCategoryIdFilter(state.categoryId ?? "");
    setServerFilters({ brandId: state.brandId ?? "", manufacturerId: state.manufacturerId ?? "", supplierOrganizationId: state.supplierOrganizationId ?? "", attributeFilters: state.attributeFilters ?? "" });
    setDeliveryUrl({ deliveryCityId: state.deliveryCityId ?? "", inCity: state.inCity ?? false });
    setSearch(null); setQuery(state.query); setSort(state.sort); setUnitFilter(state.unit); setPackagingFilter(state.packaging);
    setDeliveryFilter(state.delivery); setStockFilter(state.stock); setBrandFilter(state.brand); setCategoryFilter(state.category);
    setMinPriceFilter(state.minPrice); setMaxPriceFilter(state.maxPrice); setVerifiedOnly(state.verified); setOfficialOnly(state.official);
    restoredCount.current = state.count; setCatalogUrlReady(true);
    setCatalogHistoryRevision(value => value + 1);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const catalogReturnUrl = marketplaceCatalogUrl({ ...serverFilters, query, sort, unit: unitFilter, packaging: packagingFilter,
    ...(deliveryContext.ready ? { deliveryCityId: deliveryContext.city?.id, inCity: deliveryContext.inCity } : deliveryUrl),
    delivery: deliveryFilter, stock: stockFilter, brand: brandFilter, category: categoryFilter, categoryId: categoryIdFilter,
    minPrice: minPriceFilter, maxPrice: maxPriceFilter, verified: verifiedOnly, official: officialOnly,
    count: search?.nextOffset ?? search?.items.length ?? restoredCount.current }, catalogPath.current);
  const sharedCatalogUrl = marketplaceCatalogUrl(readMarketplaceCatalog(new URL(catalogReturnUrl, "http://local.invalid").searchParams), "/catalog");
  const browseCatalog = () => {
    if (separateCatalog) window.location.assign(sharedCatalogUrl);
    else setActive("catalog");
  };
  useEffect(() => {
    if (catalogUrlReady && active === "catalog") window.history.replaceState(window.history.state, "", catalogReturnUrl);
  }, [catalogUrlReady, active, catalogReturnUrl]);

  const loadMoreProducts = async () => {
    searchRequest.current?.abort();
    const controller = new AbortController(); searchRequest.current = controller;
    setBusy("load-more");
    try {
      const params = handoff ? buildSearchParams() : buildPublicSearchParams();
      const offset = search?.nextOffset ?? search?.items.length ?? 0;
      params.set("offset", String(offset)); params.set("limit", String(CATALOG_PAGE_SIZE));
      const next = handoff ? await api.request<SearchResult>("/marketplace/search?" + params, { signal: controller.signal }) : await fetchLiveCatalog<SearchResult>(params, controller.signal);
      if (controller.signal.aborted) return;
      setSearch(previous => controller.signal.aborted || (previous?.nextOffset ?? previous?.items.length ?? 0) !== offset
        ? previous : appendCatalogPage(previous, next));
      setError(null);
    } catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };

  const logout = useSessionLogout({ sessionKey: SESSION_KEY, sessionId: handoff?.sessionId, revoke: logoutSession, redirectUrl: LOGIN_URL });

  useEffect(() => {
    if (handoffChecked && catalogUrlReady && deliveryContext.ready) void refresh();
    // Refresh is the initial page bootstrap. Search and filter changes use
    // loadSearch directly and must not re-run the bootstrap with stale state.
  }, [handoffChecked, catalogUrlReady, catalogHistoryRevision, handoff?.sessionId, deliveryContext.ready, cityFilter]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const submitSearchFor = async (nextQuery: string, nextSort = sort) => {
    setQuery(nextQuery);
    setSort(nextSort);
    setBusy("search");
    setError(null);
    setComparison(null);
    setProductReviews(null);
    try {
      if (!handoff) {
        await loadSearch(nextQuery, nextSort);
        return;
      }
      await loadSearch(nextQuery, nextSort);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };
  const submitSearch = async () => submitSearchFor(query);

  const compare = async (productId: string, variantId?: string | null) => {
    setBusy(`compare:${productId}`);
    setError(null);
    try {
      if (!handoff && !deliveryContext.city) {
        const product = search?.items.find(({ id }) => id === productId);
        if (product) {
          setComparison({
            product: {
              id: product.id,
              name: product.name,
              brand: product.brand,
              manufacturer: product.manufacturer,
            },
            reviewSummary: product.reviewSummary,
            variants: product.variants,
            selectedVariantId: variantId ?? null,
            offers: product.offers
              .filter((offer) => !variantId || offer.variantId === variantId)
              .filter((offer) => offer.priceMinor && offer.normalizedPriceMinor)
              .map((offer) => ({
                offerId: offer.id,
                variantId:
                  offer.variantId ??
                  variantId ??
                  product.variants?.[0]?.id ??
                  "",
                supplier: {
                  organizationId: offer.supplier.id,
                  name: offer.supplier.name,
                },
                supplierSku: offer.supplierSku ?? null,
                price: {
                  amountMinor: offer.priceMinor!,
                  currency: offer.currency ?? "KZT",
                  normalizedPriceMinor: offer.normalizedPriceMinor!,
                  normalizedUnit: offer.packaging.unit ?? "ед.",
                },
                packaging: {
                  name: offer.packaging.name ?? "Упаковка",
                  quantityInBaseUnit: offer.packaging.quantityInBaseUnit,
                  unit: offer.packaging.unit,
                },
                availability: [
                  {
                    warehouse: offer.available
                      ? "Подтверждённый склад"
                      : "Остаток не подтверждён",
                    quantityAvailable: offer.available
                      ? "в наличии"
                      : "требует подтверждения",
                    updatedAt: new Date().toISOString(),
                  },
                ],
                delivery: offer.deliveryMethods.map((method) => ({
                  method,
                  minLeadTimeHours: null,
                  maxLeadTimeHours: null,
                })),
                markers: {
                  verifiedDocuments: offer.verifiedDocuments ?? true,
                  complianceRisk:
                    (offer.verifiedDocuments ?? true)
                      ? "LOW"
                      : "REVIEW_REQUIRED",
                  officialDistributor: offer.officialDistributor ?? false,
                  supplierWarranty: offer.supplierWarranty ?? true,
                  requiresConfirmation:
                    offer.confirmationMode === "MANUAL" || !offer.available,
                },
              })),
            comparisonAttributes: [],
          });
          return;
        }
      }
      const nextComparison = await api.get<Comparison>(
        `${handoff ? "/marketplace" : "/catalog"}/products/${productId}/compare?buyerOrganizationId=${buyerId}&quantity=1${variantId ? `&variantId=${encodeURIComponent(variantId)}` : ""}${deliveryContext.city ? `&cityId=${encodeURIComponent(deliveryContext.city.id)}` : ""}`,
      );
      setComparison(nextComparison);
      if (!frontendFeatures.trust) return;
      const [reviews, ...ratings] = await Promise.all([
        api.get<ProductReviews>(`/trust/products/${productId}/reviews`),
        ...nextComparison.offers.map((offer) =>
          api.get<SupplierTrust>(
            `/trust/ratings/suppliers/${offer.supplier.organizationId}`,
          ),
        ),
      ]);
      setProductReviews(reviews);
      setSupplierTrust(
        Object.fromEntries(
          nextComparison.offers.map((offer, index) => [
            offer.supplier.organizationId,
            ratings[index],
          ]),
        ),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const openProduct = (product: SearchProduct) => {
    const initialVariantId =
      product.offers[0]?.variantId ?? product.variants?.[0]?.id ?? null;
    setSelectedProduct(product);
    setSelectedVariantId(initialVariantId);
    setComparison(null);
    setProductReviews(null);
    // Show the detail surface immediately. Loading supplier offers must not
    // block the product card from opening, especially for the public fallback
    // catalog where the live API may be temporarily unavailable.
    void compare(product.id, initialVariantId);
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    setSelectedVariantId(null);
    setComparison(null);
    setProductReviews(null);
  };

  const addToCart = async (offerId: string) => {
    if (!handoff) {
      window.location.assign(LOGIN_URL);
      return;
    }
    setBusy(`cart:${offerId}`);
    setError(null);
    try {
      const cart =
        activeCart ??
        (await api.post<Cart>(`/buyers/${buyerId}/carts`, {
          currency: "KZT",
        }));
      await api.post(`/carts/${cart.id}/items`, { offerId, quantity: 1 });
      const nextCarts = await api.get<Cart[]>(`/buyers/${buyerId}/carts`);
      setCarts(nextCarts);
      await requestCartValidation(
        nextCarts.find((item) => item.status === "ACTIVE") ?? null,
      );
      setToast("Позиция добавлена в корзину");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const acceptCartChanges = async () => {
    if (!activeCart) return;
    setBusy("reprice");
    setError(null);
    try {
      await api.repriceCart(activeCart.id, {
        expectedVersion: cartValidation?.cartVersion ?? activeCart.version,
        acceptedItems: cartValidation?.items.flatMap(item => item.current ? [{ cartItemId: item.cartItemId, snapshot: item.current }] : []),
      });
      const nextCarts = await api.get<Cart[]>(`/buyers/${buyerId}/carts`);
      const nextActive =
        nextCarts.find((cart) => cart.status === "ACTIVE") ?? null;
      setCarts(nextCarts);
      await requestCartValidation(nextActive);
      setToast("Изменения цены и остатков приняты");
    } catch (cause) {
      setError(errorMessage(cause));
      await requestCartValidation(activeCart);
    } finally {
      setBusy(null);
    }
  };

  const checkout = async () => {
    if (!activeCart) return;
    if (!cartValidation?.canCheckout || cartValidation.cartVersion !== activeCart.version) {
      setError(
        cartValidation?.requiresAcceptance
          ? "Сначала примите обновлённые цены в корзине"
          : "Некоторые товары сейчас недоступны в выбранном количестве",
      );
      return;
    }
    setBusy("checkout");
    setError(null);
    try {
      await api.post(`/carts/${activeCart.id}/checkout`, {
        idempotencyKey: `buyer-ui-${activeCart.id}`,
        expectedVersion: cartValidation.cartVersion,
      });
      const [nextCarts, nextOrders] = await Promise.all([
        api.get<Cart[]>(`/buyers/${buyerId}/carts`),
        api.get<SupplierOrder[]>(`/buyers/${buyerId}/orders`),
      ]);
      setCarts(nextCarts);
      setOrders(nextOrders);
      setActive("orders");
      setToast("Заказ оформлен и разделён по поставщикам");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const reviewDraft = (orderId: string) =>
    reviewDrafts[orderId] ?? { rating: 5, comment: "" };
  const submitReview = async (orderId: string) => {
    if (!frontendFeatures.trust) return;
    const draft = reviewDraft(orderId);
    setBusy(`review:${orderId}`);
    try {
      await api.post(`/trust/orders/${orderId}/reviews`, {
        overallRating: draft.rating,
        comment: draft.comment.trim() || null,
        idempotencyKey: `buyer-review:${orderId}`,
      });
      setSubmittedReviews((items) => [...new Set([...items, orderId])]);
      setToast("Отзыв отправлен и привязан к подтверждённому заказу");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const markRead = async (id: string) => {
    setBusy(`read:${id}`);
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const downloadDocument = async (document: DocumentRecord) => {
    setBusy(`document:${document.id}`);
    setError(null);
    try {
      const result = await api.download(`/documents/${document.id}/download`);
      const url = URL.createObjectURL(result.blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download =
        result.fileName ?? `${document.title}.${document.format.toLowerCase()}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const renderCatalog = (_isPublic = false) => (
    <div className="mp-stack">
      <CompactCatalog result={search} state={readMarketplaceCatalog(new URL(catalogReturnUrl, "http://local.invalid").searchParams)} returnUrl={catalogReturnUrl}
        onLoadFilterOptions={async (categoryId, signal) => {
          const params = handoff ? buildSearchParams() : buildPublicSearchParams();
          if (categoryId) params.set("categoryId", categoryId); else params.delete("categoryId");
          params.delete("categoryName"); params.delete("attributeFilters");
          params.set("includeFilterOptions", "true"); params.set("offset", "0"); params.set("limit", "1");
          const response = handoff ? await api.request<SearchResult>("/marketplace/search?" + params, { signal }) : await fetchLiveCatalog<SearchResult>(params, signal);
          return response.filterOptions;
        }}
        loading={loading} error={error} loadingMore={busy === "load-more"} onMore={() => void loadMoreProducts()} onRetry={() => void submitSearch() } imageSource={mediaSource} />
      {selectedProduct ? (
        <div
          className={styles.productModalBackdrop}
          role="presentation"
          onClick={closeProduct}
        >
          <section
            className={styles.productModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.productModalHeader}>
              <div>
                <span className={styles.category}>
                  {selectedProduct.categories[0]?.name ?? "Стоматология"}
                </span>
                <h2 id="product-detail-title">{selectedProduct.name}</h2>
                <p>
                  {[
                    ...new Set(
                      [
                        selectedProduct.brand,
                        selectedProduct.manufacturer,
                      ].filter(Boolean),
                    ),
                  ].join(" · ")}
                </p>
              </div>
              <Button
                appearance="subtle"
                onClick={closeProduct}
                aria-label="Закрыть карточку"
              >
                Закрыть
              </Button>
            </header>
            <div className={styles.productModalBody}>
              <div
                className={styles.productModalVisual}
                onContextMenu={(event) => event.preventDefault()}
              >
                {mediaSource(selectedProduct.media?.[0]) ? (
                  <img
                    src={mediaSource(selectedProduct.media?.[0])!}
                    alt={
                      selectedProduct.media?.[0]?.altText ??
                      selectedProduct.name
                    }
                    draggable={false}
                  />
                ) : (
                  <div className={styles.productModalPhotoPending}>
                    Ищем точное фото товара
                  </div>
                )}
                <small>
                  {mediaSource(selectedProduct.media?.[0])
                    ? "Фото товара"
                    : "Покажем фото только после проверки модели"}
                </small>
              </div>
              <div className={styles.productInfo}>
                {selectedProduct.variants &&
                selectedProduct.variants.length > 1 ? (
                  <div className={styles.variantPicker}>
                    <div>
                      <span className={styles.category}>Вариант товара</span>
                      <strong>Выберите точную фасовку или REF</strong>
                    </div>
                    <DmSelect
                      value={selectedVariantId ?? ""}
                      onChange={(event) => {
                        const variantId = event.target.value;
                        setSelectedVariantId(variantId);
                        setComparison(null);
                        void compare(selectedProduct.id, variantId);
                      }}
                      aria-label="Выберите вариант товара"
                    >
                      {selectedProduct.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label}
                        </option>
                      ))}
                    </DmSelect>
                  </div>
                ) : null}
                <div className={styles.productModalCopy}>
                  <h3>О товаре</h3>
                  <p>
                    {selectedProduct.description ||
                      "Проверяем состав и характеристики товара."}
                  </p>
                  <small>
                    Описание проверено PlatformaMarket. Цену, наличие и доставку
                    указывает продавец.
                  </small>
                  {selectedProduct.attributes?.length ? (
                    <dl className={styles.productAttributes}>
                      {selectedProduct.attributes.map(([label, value]) => (
                        <div key={`${label}-${value}`}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {selectedProduct.sourceUrl ? (
                    <a
                      className={styles.productSourceLink}
                      href={selectedProduct.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть подтверждение ↗
                    </a>
                  ) : null}
                </div>
                <aside
                  className={styles.productFacts}
                  aria-label="Сводка по товару"
                >
                  <span>
                    <strong>
                      {comparison?.offers.length ??
                        selectedProduct.offers.length}
                    </strong>
                    <small>
                      {ruCount(
                        comparison?.offers.length ??
                          selectedProduct.offers.length,
                        "предложение",
                        "предложения",
                        "предложений",
                      )}
                    </small>
                  </span>
                  {frontendFeatures.trust && <span>
                    <strong>
                      {selectedProduct.reviewSummary?.averageRating?.toFixed(
                        1,
                      ) ?? "Нет оценок"}
                    </strong>
                    <small>
                      {selectedProduct.reviewSummary?.count ?? 0}{" "}
                      {ruCount(
                        selectedProduct.reviewSummary?.count ?? 0,
                        "отзыв",
                        "отзыва",
                        "отзывов",
                      )}{" "}
                      клиник
                    </small>
                  </span>}
                  <span>
                    <strong>
                      {
                        selectedProduct.offers.filter(
                          (offer) =>
                            offer.available &&
                            (offer.verifiedDocuments ?? true),
                        ).length
                      }
                    </strong>
                    <small>готовы к заказу</small>
                  </span>
                </aside>
              </div>
              <section
                className={styles.sellerSection}
                aria-labelledby="seller-list-title"
              >
                <div className={styles.sellerSectionHeader}>
                  <div>
                    <span className={styles.category}>
                      Предложения поставщиков
                    </span>
                    <h3 id="seller-list-title">Выберите продавца</h3>
                    <p>
                      Порядок учитывает наличие, проверку документов, доставку и
                      итоговую цену.
                    </p>
                  </div>
                  <span className={styles.rankingNote}>
                    Цена указана за фасовку
                  </span>
                </div>
                {busy === `compare:${selectedProduct.id}` && !comparison ? (
                  <LoadingState label="Собираем предложения поставщиков" />
                ) : !rankedComparisonOffers.length ? (
                  <EmptyState
                    icon={<ShoppingBag24Regular />}
                    title="Предложения уточняются"
                    description="Оставьте товар открытым или повторите поиск позже."
                  />
                ) : (
                  <div className={styles.sellerList}>
                    <div className={styles.sellerListHead} aria-hidden="true">
                      <span>Поставщик</span>
                      <span>Цена</span>
                      <span>Доставка и наличие</span>
                      <span>{frontendFeatures.trust ? "Надёжность" : "Документы"}</span>
                      <span />
                    </div>
                    {rankedComparisonOffers.map((offer, index) => {
                      const available = isCompareOfferAvailable(offer);
                      const trustScore =
                        supplierTrust[offer.supplier.organizationId]?.score;
                      const recommended =
                        index === 0 &&
                        available &&
                        offer.markers.verifiedDocuments;
                      return (
                        <article
                          className={
                            recommended
                              ? styles.sellerRowRecommended
                              : styles.sellerRow
                          }
                          key={offer.offerId}
                        >
                          <div className={styles.sellerIdentity}>
                            <div className={styles.sellerNameLine}>
                              <strong>{offer.supplier.name}</strong>
                              {recommended ? (
                                <span className={styles.recommendedBadge}>
                                  Рекомендуем
                                </span>
                              ) : null}
                            </div>
                            {offer.supplierSku ? (
                              <small>Артикул {offer.supplierSku}</small>
                            ) : null}
                            <div className={styles.sellerMarkers}>
                              {offer.markers.verifiedDocuments ? (
                                <StatusTag tone="success">
                                  Документы проверены
                                </StatusTag>
                              ) : (
                                <StatusTag tone="warning">
                                  Документы на проверке
                                </StatusTag>
                              )}
                              {offer.markers.officialDistributor ? (
                                <StatusTag tone="info">
                                  Официальный дистрибьютор
                                </StatusTag>
                              ) : null}
                              {offer.markers.supplierWarranty ? (
                                <StatusTag tone="neutral">Гарантия</StatusTag>
                              ) : null}
                            </div>
                          </div>
                          <div className={styles.sellerPrice}>
                            <strong>
                              {formatCatalogMoney(
                                offer.price.amountMinor,
                                offer.price.currency,
                              )} за упаковку / единицу продажи
                            </strong>
                            <small>
                              {formatCatalogMoney(
                                offer.price.normalizedPriceMinor,
                                offer.price.currency,
                              )}{" "}
                              за 1 {offer.price.normalizedUnit}
                            </small>
                            <small>{offer.packaging.name} · {offer.packaging.quantityInBaseUnit} {offer.packaging.unit}</small>
                          </div>
                          <div className={styles.sellerDelivery}>
                            <strong
                              className={
                                available
                                  ? styles.availableText
                                  : styles.pendingText
                              }
                            >
                              {available
                                ? "В наличии"
                                : "Требует подтверждения"}
                            </strong>
                            <OfferDeliverySummary options={offer.delivery} currency={offer.price.currency} />
                          </div>
                          <div className={styles.sellerTrust}>
                            {frontendFeatures.trust && <strong>
                              {trustScore != null
                                ? `${Number(trustScore).toFixed(0)}/100`
                                : "Нет истории"}
                            </strong>}
                            <small>
                              {offer.markers.verifiedDocuments
                                ? "Документы актуальны"
                                : "Документы проверяются"}
                            </small>
                          </div>
                          <Button
                            appearance={recommended ? "primary" : "secondary"}
                            icon={<Cart24Regular />}
                            onClick={() => void addToCart(offer.offerId)}
                            disabled={
                              busy === `cart:${offer.offerId}` ||
                              !available ||
                              !offer.markers.verifiedDocuments
                            }
                          >
                            {!available || !offer.markers.verifiedDocuments
                              ? "Недоступно"
                              : "В корзину"}
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
              {frontendFeatures.trust && <section className={styles.productReviews}>
                <h4>Отзывы клиник</h4>
                {!productReviews?.reviews.length ? (
                  <p>
                    Подтверждённых отзывов пока нет. Они появляются после
                    реальных заказов.
                  </p>
                ) : (
                  productReviews.reviews.slice(0, 5).map((review) => (
                    <article key={review.id}>
                      <strong>{review.overallRating} ★</strong>
                      <span>{review.comment || "Оценка без комментария"}</span>
                      {review.officialResponse ? (
                        <small>
                          Ответ поставщика: {review.officialResponse}
                        </small>
                      ) : null}
                    </article>
                  ))
                )}
              </section>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  const renderCart = () => (
    <BuyerCart
      api={api}
      onCartChanged={(next) => { setCarts((previous) => previous.map(cart => cart.id === next.id ? next : cart)); setCartValidation(null); }}
      onValidated={setCartValidation}
      cart={activeCart}
      validation={cartValidation}
      validationLoading={cartValidationLoading}
      busy={busy}
      onRefresh={() => void refresh()}
      onBrowseCatalog={browseCatalog}
      onAcceptChanges={() => void acceptCartChanges()}
      onCheckout={() => void checkout()}
    />
  );

  const renderOrders = () => (
    <BuyerOrders
      orders={buyerOrders}
      api={api}
      busy={busy}
      submittedReviews={submittedReviews}
      reviewDraft={reviewDraft}
      onReviewDraftChange={(orderId, draft) =>
        setReviewDrafts((items) => ({ ...items, [orderId]: draft }))
      }
      onSubmitReview={(orderId) => void submitReview(orderId)}
    />
  );


  const renderDocuments = () => (
    <div className="mp-stack">
      <PageHeader
        eyebrow="Документы заказа"
        title="Документы"
        description="Счета, спецификации, накладные и подписанные версии хранятся вместе с заказом."
      />
      <Section>
        {!documents.length ? (
          <EmptyState
            icon={<Document24Regular />}
            title="Документов пока нет"
            description="Документы появятся здесь после оформления заказа."
          />
        ) : (
          <div className={styles.documentList}>
            {documents.map((document) => (
              <article className={styles.document} key={document.id}>
                <div>
                  <strong>{document.title}</strong>
                  <p>
                    {document.kind} · {document.format} ·{" "}
                    {document.documentNumber ?? "без номера"} ·{" "}
                    {formatDate(document.createdAt, true)}
                  </p>
                </div>
                <div className="mp-inline-actions">
                  <StatusTag tone={statusTone(document.status)}>
                    {formatStatus(document.status)}
                  </StatusTag>
                  <Button
                    appearance="subtle"
                    onClick={() => void downloadDocument(document)}
                    disabled={busy === `document:${document.id}`}
                  >
                    Скачать
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  );

  const renderNotifications = () => (
    <div className="mp-stack">
      <PageHeader
        eyebrow="События"
        title="Уведомления"
        description="Изменения заказов, платежей, документов и доставки в одном журнале."
      />
      <Section>
        {!notifications.length ? (
          <EmptyState
            icon={<Alert24Regular />}
            title="Нет новых событий"
            description="Важные события по закупкам появятся здесь."
          />
        ) : (
          <div className={styles.notificationList}>
            {notifications.map((notification) => (
              <article className={styles.notification} key={notification.id}>
                <div>
                  <strong>{notification.subject}</strong>
                  <p>{notification.body}</p>
                  <p>
                    {notification.eventType} ·{" "}
                    {formatDate(notification.createdAt, true)}
                  </p>
                </div>
                <div className="mp-inline-actions">
                  <StatusTag
                    tone={
                      notification.priority === "CRITICAL"
                        ? "danger"
                        : notification.readAt
                          ? "neutral"
                          : "info"
                    }
                  >
                    {notification.readAt ? "Прочитано" : notification.priority}
                  </StatusTag>
                  {!notification.readAt ? (
                    <Button
                      appearance="subtle"
                      onClick={() => void markRead(notification.id)}
                      disabled={busy === `read:${notification.id}`}
                    >
                      Прочитано
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
    </div>
  );

  const content =
    active === "catalog" ? (
      renderCatalog()
    ) : active === "cart" ? (
      renderCart()
    ) : active === "orders" ? (
      renderOrders()
    ) : active === "documents" ? (
      renderDocuments()
    ) : active === "workspace" ||
      (active === "assistant" && frontendFeatures.ai) ||
      active === "support" ? (
      <BuyerServicesPanel
        mode={active}
        buyerId={buyerId}
        apiContext={apiContext}
      />
    ) : active === "smart-commerce" && frontendFeatures.recommendations ? (
      <SmartCommercePanel buyerId={buyerId} apiContext={apiContext} />
    ) : (
      renderNotifications()
    );
  const nav = navigation.map((item) =>
    item.id === "catalog" && separateCatalog
      ? { ...item, href: sharedCatalogUrl }
      : item.id === "cart" && activeCart?.items.length
      ? { ...item, badge: String(activeCart.items.length) }
      : item.id === "notifications" && unread
        ? { ...item, badge: String(unread) }
        : item,
  );

  if (!handoff && active === "catalog") {
    return (
      <div className={styles.publicStore}>
        <MarketplaceHeader showCity={false} />
        <main className={styles.publicMain} id="catalog">
          {renderCatalog(true)}
        </main>
        <footer className={styles.publicFooter}>
          <span>© PlatformaMarket</span>
          <span>Закупки для клиник и поставщиков</span>
        </footer>
      </div>
    );
  }

  return (
    <><MarketplaceHeader showCity={active !== "catalog"} /><AppShell
      productName="PlatformaMarket"
      productMark="PM"
      workspaceLabel="Кабинет клиники"
      userName={handoff?.displayName ?? "Гость"}
      userMeta={
        handoff ? "Клиника · Покупатель" : "Каталог доступен без регистрации"
      }
      navigation={nav}
      activeNavigation={active}
      contextLabel={
        active === "smart-commerce"
          ? "Рекомендации по городу"
          : active === "assistant"
            ? "AI-помощник"
            : active === "support"
              ? "Поддержка"
              : undefined
      }
      {...logout}
      onLogout={handoff ? logout.onLogout : undefined}
      onNavigate={(item) => {
        if (item === "catalog") browseCatalog();
        else if (item === "documents" && handoff) window.location.assign(workspacePath("BUYER", "/documents"));
        else if (!handoff && item !== "catalog") window.location.assign(LOGIN_URL);
        else setActive(item);
      }}
      actions={
        handoff ? (
          <>
            <BuyerServicesMenu onNavigate={setActive} />
            <Button
              appearance="subtle"
              icon={<ArrowSync24Regular />}
              onClick={() => void refresh()}
              aria-label="Обновить данные"
            />
          </>
        ) : (
          <Button
            appearance="primary"
            onClick={() => window.location.assign(LOGIN_URL)}
          >
            Войти
          </Button>
        )
      }
    >
      {active === "catalog" ? content : loading ? (
        <LoadingState label="Загружаем кабинет клиники" />
      ) : error && !search ? (
        <ErrorState
          description={error}
          action={<Button onClick={() => void refresh()}>Повторить</Button>}
        />
      ) : (
        <>
          {error ? <div className={styles.toast}>{error}</div> : null}
          {content}
        </>
      )}
      {toast ? (
        <div className={styles.toast} role="status">
          {toast}
        </div>
      ) : null}
    </AppShell></>
  );
}
