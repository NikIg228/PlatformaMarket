"use client";

import { useEffect, useState } from "react";
import styles from "../auth-split.module.css";

const phrases = [
  ["С возвращением", "в пространство", "вашего бизнеса"],
  ["Большие дела", "начинаются", "с простого входа"],
  ["Ваши закупки.", "Ваши продажи.", "Один кабинет."],
  ["Ближе", "к партнёрам.", "Проще в делах."],
  ["Новый день.", "Новые задачи.", "Вы на месте."],
];

export function LoginHeading() {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive(current => (current + 1) % phrases.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <>
      <h1 className={styles.rotatingHeading} aria-live="off" aria-label={phrases[active].join(" ")}>
        {phrases.map((lines, index) => (
          <span
            key={index}
            className={`${styles.headingPhrase} ${index === active ? styles.foldHeading : styles.hiddenPhrase}`}
            aria-hidden="true"
          >
            {lines.map(line => <span key={line} className={styles.foldLine}><span>{line}</span>{" "}</span>)}
          </span>
        ))}
      </h1>
    </>
  );
}
