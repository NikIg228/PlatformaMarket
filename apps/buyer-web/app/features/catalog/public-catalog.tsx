"use client";
import { MarketplaceHeader } from "../marketplace-header/marketplace-header";
import { catalogMediaSource } from "../../catalog/catalog-media-source";
import { CompactCatalog } from "./compact-catalog";
import { usePublicCatalog } from "./use-public-catalog";
import styles from "../../page.module.css";

export default function PublicCatalog() {
  const catalog = usePublicCatalog();
  return <div className={styles.publicStore}>
    <MarketplaceHeader showCity={false} />
    <main className={styles.publicMain} id="catalog"><div className="mp-stack">
      <CompactCatalog result={catalog.result} state={catalog.state} returnUrl={catalog.returnUrl}
        loading={catalog.loading} error={catalog.error} loadingMore={catalog.loadingMore}
        onMore={() => void catalog.more()} onRetry={() => void catalog.reload()}
        onLoadFilterOptions={catalog.loadFilterOptions} imageSource={catalogMediaSource} />
    </div></main>
    <footer className={styles.publicFooter}><span>© PlatformaMarket</span><span>Закупки для клиник и поставщиков</span></footer>
  </div>;
}
