"use client";
import { useEffect, useState } from "react";
import { Avatar } from "@fluentui/react-components";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import type { SupplierStorefront } from "@marketplace/schemas";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmHeading } from "@marketplace/ui";
import { ErrorState, LoadingState } from "@marketplace/ui/primitives";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { catalogMediaSource } from "../../catalog/catalog-media-source";
import { marketplaceCatalogUrl } from "../../catalog/marketplace-url";
import { CompactCatalog } from "./compact-catalog";
import { usePublicCatalog } from "./use-public-catalog";
import { supplierLogoSource } from "./supplier-identity";
import layout from "./public-catalog.module.css";
import styles from "./supplier-storefront.module.css";

const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
const copy = {
  ru: { catalog: "В каталог", loading: "Загружаем витрину…", unavailable: "Витрина недоступна", error: "Не удалось загрузить витрину", retry: "Повторить", products: "Товары поставщика", location: "Расположение", hours: "График работы", delivery: "Доставка", unknown: "Не указано", failed: "Попробуйте ещё раз или вернитесь в каталог.", hidden: "Поставщик сейчас не представлен в публичном каталоге." },
  kk: { catalog: "Каталогқа", loading: "Дүкен жүктелуде…", unavailable: "Дүкен қолжетімсіз", error: "Дүкенді жүктеу мүмкін болмады", retry: "Қайталау", products: "Жеткізушінің тауарлары", location: "Орналасқан жері", hours: "Жұмыс кестесі", delivery: "Жеткізу", unknown: "Көрсетілмеген", failed: "Қайталап көріңіз немесе каталогқа оралыңыз.", hidden: "Жеткізуші қазір ашық каталогта жоқ." },
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
  const content = profile?.content[locale];
  const text = (key: "description" | "location" | "hours" | "delivery") => content?.[key] || profile?.content.ru[key] || profile?.content.kk[key];
  const languageUrl = (lang?: "kk") => marketplaceCatalogUrl({ ...catalog.state, lang }, `/catalog/suppliers/${supplierId}`);
  return <div className={layout.store}>
    <MarketplaceHeader showCity={false} sticky={false} />
    <main className={layout.main} lang={locale}>
      <div className={styles.header}>
        <DmSurface className={styles.surface}>
          <div className={styles.top}>
            {profile ? <div className={styles.title}><Avatar name={profile.name} size={64} image={{ src: supplierLogoSource(supplierId, Boolean(profile.logoUrl)) }} aria-hidden="true" /><DmHeading level={1} size="page" inline title={profile.name} /></div> : null}
            <nav className={styles.actions} aria-label="Витрина"><DmButton as="a" href="/catalog">{t.catalog}</DmButton><DmButton as="a" href={languageUrl()} aria-current={locale === "ru" ? "page" : undefined}>RU</DmButton><DmButton as="a" href={languageUrl("kk")} aria-current={locale === "kk" ? "page" : undefined}>ҚАЗ</DmButton></nav>
          </div>
          {error ? <ErrorState presentation="inline" title={error === "missing" ? t.unavailable : t.error} description={error === "missing" ? t.hidden : t.failed} action={error === "failed" ? <DmButton onClick={() => setRevision(value => value + 1)}>{t.retry}</DmButton> : undefined} />
            : !profile ? <LoadingState label={t.loading} /> : <>
              {text("description") ? <p className={styles.description}>{text("description")}</p> : null}
              <dl className={styles.details}>{(["location", "hours", "delivery"] as const).map(key => <div key={key}><dt>{t[key]}</dt><dd>{text(key) || t.unknown}</dd></div>)}</dl>
              {profile.contact ? <div className={styles.contact}><span>{profile.contact.contactName}</span><DmButton as="a" appearance="subtle" href={`tel:${profile.contact.phone.replace(/[^+\d]/g, "")}`}>{profile.contact.phone}</DmButton><DmButton as="a" appearance="subtle" href={`mailto:${profile.contact.email}`}>{profile.contact.email}</DmButton></div> : null}
            </>}
        </DmSurface>
      </div>
      {profile ? <CompactCatalog storefront heading={<DmHeading title={t.products} />} result={catalog.result} state={catalog.state} returnUrl={catalog.returnUrl}
        loading={catalog.loading} error={catalog.error} loadingMore={catalog.loadingMore} onMore={() => void catalog.more()} onRetry={() => void catalog.reload()}
        onLoadFilterOptions={catalog.loadFilterOptions} imageSource={catalogMediaSource} /> : null}
    </main>
  </div>;
}
