"use client";
import { useEffect, useState } from "react";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import type { SupplierStorefront } from "@marketplace/schemas";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmHeading } from "@marketplace/ui";
import { ErrorState, LoadingState } from "@marketplace/ui/primitives";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { catalogMediaSource } from "../../catalog/catalog-media-source";
import { CompactCatalog } from "./compact-catalog";
import { usePublicCatalog } from "./use-public-catalog";
import { SupplierStorefrontHeader } from "./supplier-storefront-header";
import layout from "./public-catalog.module.css";
import styles from "./supplier-storefront.module.css";

const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
const copy = {
  ru: { loading: "Загружаем витрину…", unavailable: "Витрина недоступна", error: "Не удалось загрузить витрину", retry: "Повторить", products: "Товары поставщика", failed: "Попробуйте ещё раз или вернитесь в каталог.", hidden: "Поставщик сейчас не представлен в публичном каталоге." },
  kk: { loading: "Дүкен жүктелуде…", unavailable: "Дүкен қолжетімсіз", error: "Дүкенді жүктеу мүмкін болмады", retry: "Қайталау", products: "Жеткізушінің тауарлары", failed: "Қайталап көріңіз немесе каталогқа оралыңыз.", hidden: "Жеткізуші қазір ашық каталогта жоқ." },
};
export default function SupplierStorefrontPage({ supplierId }: { supplierId: string }) {
  const catalog = usePublicCatalog(supplierId);
  const locale = catalog.state.lang ?? "ru", t = copy[locale];
  const [profile, setProfile] = useState<SupplierStorefront | null>(null);
  const [error, setError] = useState<"missing" | "failed" | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setProfile(null); setError(null);
    void api.supplierStorefront(supplierId, controller.signal).then(value => { if (!controller.signal.aborted) setProfile(value); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof MarketplaceApiError && cause.status === 404 ? "missing" : "failed"); });
    return () => controller.abort();
  }, [supplierId, revision]);
  return <div className={layout.store}>
    <MarketplaceHeader showCity={false} sticky={false} />
    <main className={layout.main} lang={locale}>
      <div className={styles.header}>
        <nav className={styles.breadcrumb} aria-label={locale === "kk" ? "Навигация" : "Навигационная цепочка"}>
          <a href={locale === "kk" ? "/catalog?lang=kk" : "/catalog"}>Каталог</a>
          {profile ? <><span aria-hidden="true">/</span><span aria-current="page">{profile.name}</span></> : null}
        </nav>
        {profile ? <SupplierStorefrontHeader key={supplierId} profile={profile} locale={locale} /> : <DmSurface className={styles.state}>
          {error ? <ErrorState presentation="inline" title={error === "missing" ? t.unavailable : t.error} description={error === "missing" ? t.hidden : t.failed} action={error === "failed" ? <DmButton onClick={() => setRevision(value => value + 1)}>{t.retry}</DmButton> : undefined} /> : <LoadingState label={t.loading} />}
        </DmSurface>}
      </div>
      {profile ? <CompactCatalog storefront heading={<DmHeading inline title={t.products} />} result={catalog.result} state={catalog.state} returnUrl={catalog.returnUrl}
        loading={catalog.loading} error={catalog.error} loadingMore={catalog.loadingMore} onMore={() => void catalog.more()} onRetry={() => void catalog.reload()}
        onLoadFilterOptions={catalog.loadFilterOptions} imageSource={catalogMediaSource} /> : null}
    </main>
  </div>;
}
