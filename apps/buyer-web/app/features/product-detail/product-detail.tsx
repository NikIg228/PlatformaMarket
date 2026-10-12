"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Tab } from "@fluentui/react-components";
import { MarketplaceApiClient, frontendFeatures } from "@marketplace/api-client";
import { DmButton, DmSelect, DmSurface, DmTabList, EmptyState, ErrorState, LoadingState, StatusTag } from "@marketplace/ui";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { useDeliveryContext } from "../marketplace-header/delivery-context";
import { SupplierOffers } from "../catalog/supplier-offers";
import { PromotionsStorefront } from "../catalog/promotions-storefront";
import { formatCatalogMoney } from "../../catalog/catalog-view-model";
import { productLoginUrl } from "../../public-links";
import { safeCatalogReturn } from "../../catalog/marketplace-url";
import { ProductGallery } from "./product-gallery";
import { compareDecimal, offerAvailable, packageKey, packageLabel, productAttributes, selectedOffers, toSupplierOffer, type Comparison } from "./model";
import styles from "./product-detail.module.css";

export type ProductDetailProps = {
  initial: Comparison; returnTo: string; description: string | null;
  sourceUrl: string | null; image: { src: string; alt: string } | null;
  initialVariant?: string; initialPackage?: string;
};

export function ProductDetail({ initial, returnTo, description, sourceUrl, image, initialVariant = "", initialPackage = "" }: ProductDetailProps) {
  const delivery = useDeliveryContext();
  const [comparison, setComparison] = useState(initial);
  const [variantId, setVariantId] = useState(initialVariant);
  const [packaging, setPackaging] = useState(initialPackage);
  const [sort, setSort] = useState("cheapest");
  const [tab, setTab] = useState("attributes");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [loadedCity, setLoadedCity] = useState<string | null>(null);
  useEffect(() => {
    const restore = () => { const params = new URLSearchParams(window.location.search); setVariantId(params.get("variant") ?? ""); setPackaging(params.get("packaging") ?? ""); };
    restore(); window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!delivery.ready) return;
    let active = true;
    setStatus("loading");
    const city = delivery.city?.id ?? "";
    const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
    api.comparePublicOffers(initial.product.id, { quantity: 1, ...(city ? { cityId: city } : {}) })
      .then(result => { if (active) { setComparison(result); setLoadedCity(city); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [initial.product.id, delivery.ready, delivery.city?.id, revision]);
  const variant = comparison.variants.find(item => item.id === variantId) ?? comparison.variants.find(item => item.id === comparison.selectedVariantId) ?? comparison.variants[0];
  const variantOffers = comparison.offers.filter(offer => offer.variantId === variant?.id);
  const packages = Array.from(new Map(variantOffers.map(offer => [packageKey(offer), offer])).entries());
  const selectedPackage = packages.some(([key]) => key === packaging) ? packaging : packages[0]?.[0] ?? "";
  const offers = selectedOffers(comparison, variant?.id ?? "", selectedPackage, sort);
  const cheapest = offers.filter(offerAvailable).sort((a, b) => compareDecimal(a.price.amountMinor, b.price.amountMinor))[0];
  const attributes = productAttributes(comparison, variant?.id ?? "");
  const fresh = status === "ready" && delivery.ready && loadedCity === (delivery.city?.id ?? "");
  const choose = (nextVariant: string, nextPackage: string) => {
    setVariantId(nextVariant); setPackaging(nextPackage);
    const url = new URL(window.location.href);
    url.searchParams.set("variant", nextVariant);
    if (nextPackage) url.searchParams.set("packaging", nextPackage); else url.searchParams.delete("packaging");
    window.history.pushState(window.history.state, "", url.pathname + url.search);
  };
  const currentReturn = typeof window === "undefined" ? returnTo : safeCatalogReturn(new URLSearchParams(window.location.search).get("returnTo") ?? returnTo);
  const loginHref = productLoginUrl(`/products/${encodeURIComponent(initial.product.id)}?${new URLSearchParams({ returnTo: currentReturn, variant: variant?.id ?? "", packaging: selectedPackage })}`);
  const facts: Array<[string, string]> = [
    ...(comparison.product.manufacturer ? [["Производитель", comparison.product.manufacturer] as [string, string]] : []),
    ...(variant?.sku ? [["Артикул", variant.sku] as [string, string]] : []),
    ...attributes.slice(0, 3),
  ];
  return <div className={styles.page}>
    <MarketplaceHeader />
    <main className={styles.shell}>
      <nav aria-label="Навигация по каталогу"><Link className={styles.back} href={currentReturn}>← Каталог</Link></nav>
      <section className={styles.hero} aria-label="Товар">
        <ProductGallery image={image} name={comparison.product.name} />
        <div className={styles.identity}>
          {comparison.product.brand ? <p className={styles.brand}>{comparison.product.brand}</p> : null}
          <h1>{comparison.product.name}</h1>
          <dl className={styles.facts}>{facts.map(([name, value], index) => <div key={`${name}-${index}`}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
          <div className={styles.choiceGroup}>
            <strong>Вариант товара</strong>
            {comparison.variants.length ? <div className={styles.choices} aria-label="Варианты товара">{comparison.variants.map(item => <DmButton key={item.id} aria-pressed={item.id === variant?.id} onClick={() => choose(item.id, "")}>{item.label || item.sku || "Основной вариант"}</DmButton>)}</div> : <p className={styles.muted}>Варианты пока не добавлены</p>}
          </div>
          <div className={styles.choiceGroup}>
            <label htmlFor="product-packaging"><strong>Фасовка</strong></label>
            {packages.length ? <DmSelect id="product-packaging" value={selectedPackage} disabled={!fresh} onChange={(_, data) => choose(variant?.id ?? "", data.value)}>{packages.map(([key, offer]) => <option key={key} value={key}>{packageLabel(offer)}</option>)}</DmSelect> : <p className={styles.muted}>{fresh ? "Нет фасовок с актуальной ценой" : "Проверяем доступные фасовки…"}</p>}
          </div>
          <DmButton as="a" appearance="subtle" href="#product-information" onClick={() => setTab("attributes")}>Все характеристики ↓</DmButton>
        </div>
        <DmSurface className={styles.purchase}>
          <p className={styles.muted}>Предложения для выбранного варианта</p>
          {fresh && cheapest ? <><strong className={styles.price}>от {formatCatalogMoney(cheapest.price.amountMinor, cheapest.price.currency)}</strong><p className={styles.caption}>За единицу продажи · {packageLabel(cheapest)}</p><StatusTag tone="success">Есть в наличии</StatusTag></>
            : <p role="status">{status === "error" ? "Цены временно недоступны" : !fresh ? "Обновляем цены и наличие…" : "Нет доступных предложений"}</p>}
          <DmButton as="a" href="#supplier-offers" appearance="primary">{fresh && offers.length ? "Выбрать поставщика" : "Посмотреть предложения"}</DmButton>
          <div className={styles.purchaseNote}>
            <strong>{delivery.city ? `Доставка: ${delivery.city.nameRu}` : "Выберите город доставки в шапке"}</strong>
            <p className={styles.caption}>Сравните сроки и стоимость у поставщиков. Доставка не включена в цену товара.</p>
            <p className={styles.caption}>Цена и наличие повторно проверяются при оформлении заказа.</p>
          </div>
        </DmSurface>
      </section>
      <section id="supplier-offers" className={styles.section} aria-labelledby="suppliers-title">
        <DmSurface variant="section"><div className={styles.sectionInner}>
          <div className={styles.heading}>
            <div className={styles.headingCopy}><h2 id="suppliers-title">Предложения поставщиков</h2>{fresh ? <StatusTag tone="neutral">{offers.length}</StatusTag> : null}</div>
            {fresh && offers.length > 1 ? <label className={styles.sort}>Сортировка<DmSelect aria-label="Сортировка предложений" value={sort} onChange={(_, data) => setSort(data.value)}><option value="cheapest">Сначала дешевле</option><option value="expensive">Сначала дороже</option><option value="supplier">По поставщику</option></DmSelect></label> : null}
          </div>
          {fresh && offers[0] ? <p className={styles.muted}>{variant?.label} · {packageLabel(offers[0])}</p> : null}
          {status === "error" ? <ErrorState title="Не удалось загрузить предложения" description="Проверьте подключение и повторите попытку. Выбор товара сохранён." action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить загрузку</DmButton>} />
            : !fresh ? <LoadingState label="Загружаем актуальные предложения" />
            : !offers.length ? <EmptyState title="Предложений пока нет" description="Для этого варианта и города нет предложений с актуальной ценой. Попробуйте другой вариант или город." /> : null}
          {/* Keep the pending-write lock and outcome alive across selection/city changes. */}
          <SupplierOffers offers={fresh ? offers.map(toSupplierOffer) : []} productName={`${comparison.product.name} · ${variant?.label ?? variant?.sku ?? ""}`} loginHref={loginHref} comparison />
        </div></DmSurface>
      </section>
      <section id="product-information" className={styles.section} aria-label="Информация о товаре">
        <DmSurface variant="section"><div className={styles.sectionInner}>
          <DmTabList className={styles.tabs} selectedValue={tab} onTabSelect={(_, data) => setTab(String(data.value))} aria-label="Информация о товаре">
            <Tab id="attributes-tab" value="attributes" aria-controls="product-tab-panel">Характеристики</Tab><Tab id="description-tab" value="description" aria-controls="product-tab-panel">Описание</Tab><Tab id="documents-tab" value="documents" aria-controls="product-tab-panel">Документы</Tab>
          </DmTabList>
          <div id="product-tab-panel" role="tabpanel" aria-labelledby={`${tab}-tab`} tabIndex={0} className={styles.tabPanel}>
            {tab === "attributes" ? <><h2>Характеристики товара</h2>{facts.length ? <dl className={`${styles.facts} ${styles.detailsFacts}`}>{[...facts.slice(0, facts.length - Math.min(attributes.length, 3)), ...attributes].map(([name, value], index) => <div key={`${name}-${index}`}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : <p className={styles.muted}>Характеристики пока не добавлены.</p>}</>
              : tab === "description" ? <><h2>Описание товара</h2><p className={styles.description}>{description || "Описание пока не добавлено."}</p>{description ? <p className={styles.caption}>Описание относится к линейке товара. Исполнение и комплектацию уточняйте по выбранному артикулу.</p> : null}{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Источник описания ↗</a> : null}</>
              : <><h2>Документы на товар</h2><p className={styles.muted}>Файлы документов пока не опубликованы. Запросите документы на выбранный товар у поставщика перед покупкой.</p></>}
          </div>
        </div></DmSurface>
      </section>
      {frontendFeatures.promotions ? <PromotionsStorefront productId={initial.product.id} hideEmpty /> : null}
    </main>
  </div>;
}
