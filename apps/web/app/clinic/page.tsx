import Link from "next/link";
import styles from "../workspaces/workspace.module.css";
export default function ClinicPage() {
  return <nav className={styles.actions} aria-label="Быстрые переходы клиники">
    <Link href="/catalog">Перейти в каталог</Link>
    <Link href="/clinic/cart">Открыть корзину</Link>
    <Link href="/clinic/orders">Посмотреть заказы</Link>
  </nav>;
}
