import { DmButton } from "@marketplace/ui/controls";
import Link from "next/link";
import styles from "./page.module.css";

const clinicBenefits = ["Сравнение цены за базовую единицу", "Актуальные остатки и сроки поставки", "Бюджеты, согласования и повтор закупки", "Документы и уведомления в одном контуре"];
const supplierBenefits = ["Единая витрина предложений и остатков", "Импорт из CSV, API, ERP и 1С", "Акции и аналитика продаж", "Доступ после договора с ЭЦП"];

export default function AboutPage() {
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/"><span>PM</span><strong>PlatformaMarket</strong></Link><nav><Link href="/">В магазин</Link><a href="#clinics">Клиникам</a><Link href="/suppliers">Поставщикам</Link><Link href="/login">Войти</Link></nav></header>
    <section className={styles.hero}><p className={styles.eyebrow}>О платформе</p><h1>Профессиональная закупка для стоматологии Казахстана</h1><p>PlatformaMarket объединяет каталог, сравнение предложений, остатки, заказы, документы и контроль исполнения. Сам магазин открыт без регистрации; аккаунт нужен при оформлении заказа и работе с кабинетом.</p><div><Link className={styles.primary} href="/">Перейти в магазин</Link><DmButton as="a" appearance="secondary" className={styles.secondary} href="https://dentmarket-about.vercel.app/register?role=buyer">Зарегистрировать клинику</DmButton></div></section>
    <section className={styles.section} id="clinics"><p className={styles.eyebrow}>Для клиник</p><h2>Закупка без цепочки звонков</h2><div className={styles.grid}>{clinicBenefits.map((benefit, index) => <article key={benefit}><span>0{index + 1}</span><h3>{benefit}</h3></article>)}</div></section>
    <section className={styles.supplier} id="suppliers"><div><p className={styles.eyebrow}>Для поставщиков</p><h2>Один канал продаж и исполнения</h2><p>Ассортимент, остатки, заказы, интеграции и юридический контур собраны в одном кабинете.</p><DmButton as="a" appearance="secondary" className={styles.light} href="https://dentmarket-supplier.vercel.app">Кабинет поставщика</DmButton></div><ol>{supplierBenefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ol></section>
    <section className={styles.legal}><p className={styles.eyebrow}>Юридический контур</p><h2>Договор с ЭЦП появляется только тогда, когда нужен</h2><p>После двух проверенных подписей договор действует 12 месяцев. Пока он активен, повторное окно подписи недоступно; новый цикл запускается при завершении срока или обязательном изменении условий.</p></section>
    <footer className={styles.footer}><Link href="/">PlatformaMarket · Магазин</Link><span>© 2026</span></footer>
  </main>;
}
