# Аудит визуального контракта — 06.10.2026

Scope: всё приложение Market, включая импортируемые legacy entry points.
Основание: прямое расширение владельцем UI-CONTRACT до полной нормализации.
[Контракт](COMPONENT_CONTRACT.md) · [checkpoint](../governance/task-state/UI-CONTRACT-2026-10-06.md).
Baseline main@2fe8c1f; сохранённый Support/Orders/Notifications WIP не является
разрешением на публикацию его бизнес-логики.

## Покрытие исходников

Полный статический проход:315 CSS/TSX sources,69 stylesheets. Generated assets,
node_modules, build output и tests исключены из продуктового inventory.

| Зона | CSS | TSX |
| --- | ---: | ---: |
| apps/admin-web | 19 | 37 |
| apps/buyer-web | 17 | 46 |
| apps/landing-web | 3 | 16 |
| apps/supplier-web | 15 | 31 |
| apps/web | 10 | 91 |
| packages/ui | 5 | 25 |

Механический inventory проверен по CSS declarations, JSX imports/native controls,
inline styles и связям CSS modules с adapters. Это не утверждение, что каждый
бизнес-сценарий каждой страницы пройден в браузере.

## Находки и исправления

| Класс проблемы | Выполнено |
| --- | --- |
| Несуществующие CSS variables |7 ссылок заменены на существующие semantic tokens; guard проверяет весь UI |
| Неполная тёмная тема | единая light-only тема, сохранённая preference не удаляется |
| Разные шрифты | Manrope base/numeric; CSS variable в html всех5 layouts; mono отдельно |
| Разрозненные размеры, отступы, радиусы |3150 declarations в66 CSS files нормализованы к versioned contract |
| Literal colours и unrelated palettes |70 замен на семантические цвета/colour-mix |
| Inline styles |37 исправлений; typography/spacing/radius проверяются guard |
| Локальная геометрия стандартных controls |361 declarations удалены в18 stylesheets; дополнительные overrides найдены новым guard и убраны |
| Прямые Fluent/native widgets | общие adapters; сохранены name/ref/file/change и accessibility semantics |
| CTA anchors | общий вид кнопки через DmButton as=a или dmLinkButtonProps; обычные ссылки сохранены |
| Поля композера | explicit shared composer с общей границей, focus и error |
| Двойной focus | единый внешний1px/offset2, pointer без ring; forced-colours поддержан |
| Mobile promotions | после смены typography обнаружен overflow; horizontal TabList скроллится внутри своей ширины |
| Popup/dialog/menu | radius12/16/8; общая elevation и compact options |

Layout остаётся в feature: grid/flex, ширина, breakpoint, alignment, responsive
композиция и размеры иллюстраций. DmAction row/choice/tab/navigation/text сохраняет
геометрию по содержанию, используя общие tokens и интерактивные состояния.
Pill/circle допустимы для badges/avatar; flush edges имеют radius0.

## Runtime и regression evidence

- Public catalog1440/390, OS dark + persisted dark и dev component gallery1440/390:
 5 PASS; native form, dropdown/combobox, keyboard, dialog return focus, disabled,
 search clear и отсутствие page overflow.
- Реальные consumers: offer inspector1440/390, supplier search/focus1440/390,
 registration errors/checkbox,6 product pages desktop/mobile, operator supplier
 operations, clinic/supplier documents и mobile navigation. Первый расширенный
 проход10 PASS/1 FAIL (promotions overflow); после исправления6 affected PASS.
- Support fixture4 PASS: mobile navigation/reopen/retry, file validation/recovery,
 compact composer1440/390. Скриншоты desktop/mobile просмотрены.
- Shared UI unit76 PASS в14 suites; policy guard4 PASS и315sources PASS.
- Web/UI/e2e и4 legacy scoped types PASS. Final lint PASS, включая self-closing
 native widgets; go_live canonical web build1 PASS (47 static pages).
- Visual matrix auth/products1440/390 и admin recovery1440/390:4 PASS после
 исправления2 неверных test locators. Снимки в .tmp/ui-contract/visual{,-fixed}.

Отдельная прежняя проблема обработки данных: admin LiveMetrics не проверяет
response.ok; при503 body вместо массива показывает undefined. Зафиксирована
для отдельного functional scope, в текущем изменении стилей не исправлялась.

Исторический блокер, снятый явным разрешением владельца на общую публикацию
06.10: см. [PUBLISH-WIP](../governance/task-state/PUBLISH-WIP-2026-10-06.md).
Прежний статус публикации BLOCKED: исходный index tree a57124f сохранён. Проверка переноса только
own diff на HEAD в отдельном Git index (без нового checkout) выявила конфликты
в orders.tsx, support.tsx, UI index.tsx, order-workflow-workspace.tsx и styles.css;
ещё3 исправленных Support файла пока отсутствуют в HEAD. Commit/push/CI не
выполнялись. Следующий шаг — отдельная приёмка и фиксация сохранённого чужого
Support/Orders WIP, затем публикация этого UI diff. Это не UI gate PASS для WIP.

Все UI write flows выполнялись на перехваченных fixtures. Рабочая БД не менялась.
Backend/PG/release/full E2E не выполнялись: доменные операции не изменены этой
задачей. Проверки визуального слоя не сертифицируют чужие backend изменения.

## Предотвращение повторений

npm run verify:ui-contract входит в root lint/CI. ESLint запрещает raw native
widgets и прямые базовые Fluent imports вне adapter. Guard проверяет raw styles,
локальный focus, unknown tokens, inline control styling и CSS-module geometry.
Сложные dynamic selectors и итоговый cascade требуют code review и браузера.
Не добавлять новые локальные размеры обычных controls ради отдельной страницы:
расширять общий variant и проверять затронутых consumers.

Применены Development Toolkit frontend/verification/review, Web Interface
Guidelines и прочитанные Agency UI Designer/Frontend Developer checklist:
существующие tokens, семантика, иерархия, клавиатура, responsive и recovery.
