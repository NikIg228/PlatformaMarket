"use client";
import { resilientGet } from "../../resilient-get";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useBuyerSession } from "../../use-buyer-session";
import { catalogContext, deliveryDestination } from "./navigation";

type City = { id: string; nameRu: string };
type Delivery = { cities: City[]; city: City | null; ready: boolean; inCity: boolean; message: string; retry: () => void; choose: (id: string, inCity: boolean) => void };
const Context = createContext<Delivery>({ cities: [], city: null, ready: false, inCity: false, message: "", retry() {}, choose() {} });
export const useDeliveryContext = () => useContext(Context);
export function DeliveryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const buyer = useBuyerSession();
  const [value, setValue] = useState<Omit<Delivery, "retry" | "choose">>({ cities: [], city: null, ready: false, inCity: false, message: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!buyer.ready) return;
    const controller = new AbortController();
    setValue(v => ({ ...v, ready: false }));
    void (async () => {
      const params = new URL(catalogContext(window.location.pathname, window.location.search), window.location.origin).searchParams;
      const { publicCityListResponseSchema } = await import("@marketplace/schemas");
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";
      const response = await resilientGet(`${apiUrl}/catalog/cities`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]), cache: "no-store" });
      if (!response.ok) throw Error("Не удалось загрузить города. Повторите попытку.");
      const cities = publicCityListResponseSchema.parse(await response.json());
      const storageKey = `platforma:delivery-city:${buyer.session?.organizationId ?? "guest"}`;
      let saved: string | null = null;
      try { saved = localStorage.getItem(storageKey); if (!saved && !buyer.session) saved = JSON.parse(localStorage.getItem("dentmarket:city") ?? "null")?.id ?? null; } catch { /* Browser storage is optional. */ }
      let id = params.get("deliveryCityId") ?? saved;
      let profileMessage = "";
      if (id === null && buyer.session) {
        try {
        const { MarketplaceApiClient } = await import("@marketplace/api-client");
        const { sessionApiContext } = await import("../../workspace-session");
        const profile = await new MarketplaceApiClient(apiUrl, sessionApiContext).getOrganizationProfile();
        id = profile.profile?.deliveryAddress.cityId ?? null;
        } catch { profileMessage = "Не удалось определить город из адреса организации. Выберите город вручную."; }
      }
      const city = cities.find(c => c.id === id) ?? null;
      if (!controller.signal.aborted && city && window.location.pathname.startsWith("/products/") && !params.get("deliveryCityId")) {
        router.replace(deliveryDestination(window.location.pathname, window.location.search, city.id, false, false), { scroll: false });
      }
      if (!controller.signal.aborted) setValue({ cities, city, ready: true, inCity: Boolean(city && params.get("inCity") === "true"), message: id && !city ? "Сохранённый город больше недоступен. Выберите город заново." : profileMessage });
    })().catch(() => { if (!controller.signal.aborted) setValue({ cities: [], city: null, ready: true, inCity: false, message: "Не удалось загрузить город доставки. Повторите попытку." }); });
    return () => controller.abort();
  }, [buyer.ready, buyer.session?.organizationId, revision, router]);
  useEffect(() => {
    const restore = () => {
      const params = new URL(catalogContext(window.location.pathname, window.location.search), window.location.origin).searchParams;
      const id = params.get("deliveryCityId") ?? "";
      setValue(current => {
        if (!current.ready) return current;
        const city = current.cities.find(item => item.id === id) ?? null;
        return { ...current, city, inCity: Boolean(city && params.get("inCity") === "true"),
          message: id && !city ? "Сохранённый город больше недоступен. Выберите город заново." : "" };
      });
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  const choose = (id: string, inCity: boolean) => {
    if (id && !value.cities.some(c => c.id === id)) return;
    try { localStorage.setItem(`platforma:delivery-city:${buyer.session?.organizationId ?? "guest"}`, id); localStorage.removeItem("dentmarket:city"); } catch { /* Selection remains in the URL. */ }
    const city = value.cities.find(item => item.id === id) ?? null;
    const selectedInCity = Boolean(city && inCity);
    const destination = deliveryDestination(window.location.pathname, window.location.search, id, selectedInCity);
    setValue(current => ({ ...current, city, inCity: selectedInCity, message: "" }));
    if (destination === window.location.pathname + window.location.search) return;
    if (window.location.pathname.startsWith("/products/")) {
      // Product offers are server-rendered: refresh them through Next navigation.
      router.push(destination, { scroll: false });
    } else {
      // The catalog already restores filters and reloads results on popstate.
      window.history.pushState(window.history.state, "", destination);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };
  return <Context.Provider value={{ ...value, choose, retry: () => setRevision(v => v + 1) }}>{children}</Context.Provider>;
}
