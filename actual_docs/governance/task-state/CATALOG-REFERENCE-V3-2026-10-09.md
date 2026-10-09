# CATALOG-REFERENCE-V3 — каталог по утверждённому референсу

Обновлено: 09.10.2026. LOCAL_PASS / PUBLICATION_PENDING. Исполнитель UI: `01a11795-17a2-7f52-9e7d-b3314bf87ed7`.
Основание: явное поручение владельца реализовать последний catalog-v3.
Primary проверен idle/completed; реестр владения не переносится.
Checkout: canonical root, main `262309c553bc9292325f67f8c3070369f0749bf4`.
Исходный dirty: только собственные output/imagegen/catalog-product-reference-2026-10-09.

Scope: R7, публичный каталог; существующие поиск/город/фильтры/сортировка,
переход в товар и выбор поставщика сохраняются. Backend, рабочая БД и страница
товара не меняются. Данные в карточках берутся из API; synthetic fixtures только
для тестов. Preview акций остаётся development-only.

Паспорт: component-contract и semantic-light-v1, Manrope, body14/21,
название16, цена20, heading28, controls44/radius8, cards radius12.
Reference1486×1077: outer32, grid gap16, пять колонок около271px,
фото почти квадратное, акции aspect1.6:1; toolbar между header и акциями.
Desktop header64, только toolbar sticky top0. DmSearch сохраняет контракт440px,
генератор показал более широкое поле: это отличие заявлено владельцу до записи.
Зелёная статичная «Все акции →» справа панели; heading/count/sort над товарами.
Mobile: reflow controls, статичная сетка акций 3/2 колонки без прокрутки
(сохранено явное решение владельца08.10), адаптивная сетка товаров.

Риски: sticky/focus, потеря URL filters/sort, неверные единицы/число поставщиков,
длинные названия и отсутствие offers/media. Shared controls без overrides.
План проверки: focused presentation unit + существующие catalog cases;
browser desktop/mobile, sort/filter/modal/keyboard, screenshots/computed styles;
buyer/web types, scoped lint, UI contract, completion go_live web build,
diff review, scoped commit/push и actual CI receipt. Без общих DB/E2E suites.
Реализация: toolbar/featured/title/grid по референсу, vendor CTA и реальные
brand/parameters/packaging/supplier counts/availability, shared sort dropdown.
Preview: пять новых landscape WebP, визуально проверены; production получает
только API promotions с механикой, поставщиком, сроком и ссылкой на товар.
Checks: initial unit6 PASS, final card/presentation/featured unit5 PASS;
buyer/web types initial PASS, UI-contract initial PASS345.
Browser1 PASS2 (1440/390), browser2 CLI_ERROR import.meta в CommonJS fixture;
исправлен на __dirname, browser3 и остальные final gates выполняются.
После screenshot review сохранён flat canvas без прежних gradients/пустого96px.
Статичная mobile grid требует обновлённого screenshot (последняя CSS правка).
Логи .tmp/catalog-v3-*, screenshots output/playwright/catalog-v3*.
Final checks: buyer/web/e2e types PASS; scoped ESLint PASS; UI-contract348 PASS.
Browser3 PASS6: catalog reference desktop/mobile, actual cart action/rejection/
unknown-write feedback desktop/mobile, pagination recovery, filter/offline focus.
Browser2 fixture-only CLI failure исправлен; assertions не ослаблены.
go_live web build1 PASS; после review исправлено склонение счётчика товаров,
поэтому final build2 ещё PENDING. API/schema/DB domain не менялись.
Последняя mobile CSS правка требует только визуальной повторной проверки.
Применены Development Toolkit, Web Interface Guidelines, Agency Frontend
Developer/UI Designer (tokens, responsive layout, accessibility), Code Reviewer
(контракты/данные/recovery), Git Workflow Master (scoped diff/fast-forward).
Финал: статичная mobile grid и desktop повторно проверены (PASS2), screenshots
`output/playwright/catalog-v3-static`; реальные данные проверены отдельным
read-only browser smoke и `computed.json`. Desktop1440: card262.39,
photo236.39×236.39, button44/radius8, card radius12. Scroll600: header y−600,
toolbar y0. Mobile390: scrollWidth390, card358, photo332, toolbar164.
Были две ошибки native browser session (исчезнувшая вкладка и timeout
расширения); финальный штатный Playwright visual smoke PASS, дефекта приложения нет.
Final go_live build2 PASS; buyer types и scoped lint после склонения count PASS.
Итого9 уникальных unit cases и6 browser cases PASS, без полного backend/DB/E2E gate.
Предыдущие PASS переиспользованы только для неизменённых входов.
Build останавливал только проверенное canonical Market dev tree; обычный
`npm run dev` восстановлен: wrapper17812, API18072:4012, Next14568:3000;
go_live/JWT readiness и catalog HTTP200. Другие проекты и рабочая БД не изменены.
Review: безопасные API-данные, точная цена из существующего helper, уникальные
supplier IDs, отсутствие control overrides и посторонних изменений проверены.
Следующий шаг: scoped commit/push и CI receipt. next-env вернулся к baseline.

## Сопоставление с референсом

| Элемент | Референс / реализация |
| --- | --- |
| Порядок | header → поиск/город/категории/фильтры/акции → 5 промо → заголовок/число/сортировка → товары |
| Ширина | max1600; desktop поля32, промежутки16, пять одинаковых колонок |
| Поиск | shared DmSearch440×44; ширина растрового примера не переносится в контракт |
| Промо | горизонтальный прямоугольник1.6:1; на1440 около262×164; mobile2 колонки без scroll |
| Товар | фото1:1 внутри карточки; полный заголовок, brand/параметры, цена единицы продажи |
| Действие | shared primary44 «Выбрать поставщика», существующий modal и возврат focus |
| Scroll | глобальный header в обычном потоке, toolbar sticky top0 |
| Отличия данных | реальные product photos/API могут отличаться от иллюстраций; synthetic цены только intercepted tests |
