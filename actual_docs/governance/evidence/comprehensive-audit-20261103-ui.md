# UI/UX аудит PlatformaMarket — 03.11.2026

Статус: bounded review завершён; browser evidence координатора добавлено ниже.
Не является общей UI/production приёмкой.

## Итог исполнения координатора

На той же версии pilot suite `npm run verify:web`: 123 PASS, 5.7мин (смешанное
real/mock покрытие). Дополнительные real operator orders/organizations/projections:
3 PASS, 12.2с; первая попытка ошиблась портом diagnostic harness4113 при baked
rewrite4012, вторая исправила только `.tmp` config. Go_live web build PASS;
12 representative documents/messages/support tests PASS, 49.5с, ответы API
перехвачены fixtures: это UI evidence, не backend acceptance.

Специальный UI audit: 6 tests, 4 PASS, 2 FAIL, обе ошибки воспроизводят дефекты.
AUD-UI01: ERP request dialog наблюдался1440/390, Escape возвращает focus, mobile
menu закрывается с возвратом focus, горизонтального overflow нет.
AUD-UI02: KK календарь и русские соседние tabs наблюдались на390; дополнительный
CSS zoom200% при1440 не дал горизонтального overflow. CSS zoom не заменяет
native browser zoom или screen-reader acceptance. AUD-UI03: после503 error copy
исчезает через5.6с, «Повторить» остаётся; assertion persistent error FAIL.
AUD-UI04: computed hover placeholder contrast4.475422 при14px/400/opacity1,
assertion>=4.5 FAIL. Operator real money/doc detail и mobile menu keyboard PASS.
Screenshots/computed files: `.tmp/comprehensive-audit-20261103/ui-results/`;
результаты и версии входят в общий evidence pack. Нижние NOT_RUN в исходном плане
описывают состояние до запуска; итог этого раздела имеет приоритет.

Остаются ограничения: не все50routes/роли/языковые комбинации проверены руками;
нет полного screen-reader/native/device matrix. Полная KK локализация не принята.

База: `main@4543fd22c92464bb72fe75a627bb225adb921fde`, канонический
`C:/Users/user/Desktop/dentmarket-kz-main`. Код и рабочие данные не изменялись.
Существующий WIP сохранён. Разрешённый артефакт этого исполнителя — только этот файл.
Общими сборками, тестами и изолированными серверами владеет координатор аудита.

## Метод и границы

Прочитаны AGENTS и apps/web/AGENTS, DESIGN_SYSTEM, UI_UX_IMPLEMENTATION_STANDARD,
`component-contract.json`, `semantic-light.json`, antislop. Anti-slop применяется
в режиме AFTER по решению текущей сессии и адаптации владельца: без навязывания
редизайна, новых функций, вопросов о режиме и отдельного финального формата.
Функциональная пригодность и утверждённые дизайн-контракты важнее декора.

Код подтверждает присутствие компонентов и ветвей; он не подтверждает фактический
focus/contrast/overflow/computed styles. Отдельные historical screenshot/PASS не
перенесены на весь интерфейс. EN отложен в PROJECT_OVERVIEW: проверяется честность
поддержки, отсутствие EN не объявляется нарушением обязательного RU/KK scope.

## Инвентарь маршрутов

Обнаружено 50 `page.tsx` в unified `apps/web/app`. Route groups удалены из URL.
У admin один основной маршрут, внутренние разделы выбираются query; число страниц
не равно числу операторских экранов. Legacy entry points используются импортами.

| Роль/область | Маршруты | Реализация |
| --- | --- | --- |
| Public (8) | `/`, `/catalog`, `/catalog/suppliers/[supplierId]`, `/products/[id]`, `/promotions`, `/suppliers`, `/about`, `/personal/cart` | buyer-web features/catalog, products, suppliers, about, personal-cart |
| Auth/legal (8) | `/login`, `/register`, `/register/resume`, `/invitation`, `/reset-password`, `/verify-email`, `/legal/privacy`, `/legal/terms` | landing-web соответствующие screen-компоненты |
| Clinic (12) | `/clinic`, `/clinic/catalog`, `/clinic/cart`, `/clinic/orders`, `/clinic/orders/[id]`, `/clinic/documents`, `/clinic/messages`, `/clinic/notifications`, `/clinic/analytics`, `/clinic/profile`, `/clinic/settings`, `/clinic/support` | web/app/workspaces; clinic/catalog — redirect в общий каталог |
| Supplier (19) | `/supplier`, `/supplier/orders`, `/supplier/orders/[id]`, `/supplier/documents`, `/supplier/messages`, `/supplier/notifications`, `/supplier/analytics`, `/supplier/profile`, `/supplier/settings`, `/supplier/settings/sources`, `/supplier/support`, `/supplier/legal/[code]`, `/supplier/products`, `/supplier/products/new`, `/supplier/products/import`, `/supplier/products/inventory`, `/supplier/products/corrections`, `/supplier/products/proposals`, `/supplier/products/promotions` | workspaces + импортируемые supplier-web features и shared promotion workspace |
| Admin (2) | `/admin/login`, `/admin` | admin-web/login и operations-workspace; внутренние sections/query отдельно |
| Dev (1) | `/dev/ui-kit` | samples; наличие маршрута не означает production-доступ |

Для всех групп требуется разделять anonymous, personal, clinic, supplier, operator,
denied/missing permissions и истёкшую сессию. Profile/settings относятся к разным
объектам: личный аккаунт и организация. Личный checkout не входит в реализованный П01.

## Проверенные статические свойства

| Поверхность | Доказательство | Результат и предел |
| --- | --- | --- |
| Shared tokens | packages/ui/src/component-contract.json, semantic-light.json | Размер44/32, body14, card12/dialog16, семантические состояния заданы; runtime соответствие отдельно |
| Shared provider | packages/ui/src/provider.tsx | Fluent theme + input modality + SaveToastProvider; не введена альтернативная система |
| Modal | packages/ui/src/primitives.tsx:27–71 | DmDialog использует Fluent Dialog/Surface, labelled title, shared close control; фактическое trap/restore ещё browser |
| Mobile shell | apps/web/app/workspaces/workspace.tsx:95–126, workspace.module.css mobile block | Первый nav focus при открытии, Escape/resize restore; скрытый sidebar display:none; статически предусмотрено |
| Skip link | workspace.tsx и workspace.module.css `.skip` | Ссылка к содержимому, показ при focus; реальная фокусировка target ещё browser |
| Async resources | workspaces/use-resource.ts | AbortController/sequence, loading/refreshing/offline/stale, visibility/focus/online recovery; это не проверка каждого consumer |
| Orders | workspaces/orders.tsx:16–52 | URL q/status/group, filters/reset, initial loading/error/retry/empty, отдельная mobile card композиция и pagination |
| Products/inventory | workspaces/products.tsx, supplier-inventory.tsx | Поиск/фильтры, pagination, state feedback, named bulk VAT checkboxes; phone таблицы требуют browser |
| Drafts | settings-calendar.tsx, settings.tsx, offer-panel.tsx, use-support-drafts.ts | Защита dirty и recoverable input предусмотрена; navigation/cold recovery требуют проверки |
| Documents | workspaces/documents.tsx → DocumentRegistry | Unified путь использует новый registry, не старую DocumentArchiveTable; не переносить legacy дефекты без reachability |
| Reduced motion | packages/ui/src/styles/controls.css:161, interaction-adapters.css:13/96 | Shared controls/toasts имеют reduced-motion CSS; покрытие всех surfaces ещё не доказано |
| Localised slices | settings-calendar.tsx, order-response-deadline.tsx, personal-cart.tsx | RU/KK copy и локальный lang; это ограниченное покрытие, не весь RU/KK интерфейс |

## Подтверждённые находки

### AUD-UI01 — ERP «Подключить» создаёт обращение вместо self-service

- Категория: функциональный/UX разрыв требований; severity medium, priority P1.
- Статус: CONFIRMED_STATIC, browser NOT_RUN. Новая регрессия не доказана.
- Требование: AGENTS §1 и актуальный функциональный scope: ERP подключается
  самостоятельно в кабинетах; заявка в поддержку исключена как штатный способ.
- Reachability: `apps/web/app/supplier/settings/sources/page.tsx` →
  `workspaces/supplier-product-pages.tsx:70–71` → `SettingsSources`; тот же компонент
  доступен через `settings.tsx` с `?tab=sources`.
- Root: `apps/web/app/workspaces/settings-sources.tsx:27–29,52–64`.
- Actual: карточки 1С/МойСклад обещают «Подключение с помощью специалиста»;
  «Подключить» открывает форму, submit вызывает `api.createSupportTicket`, а не
  создание/проверку интеграционного подключения. У пользователя с import.manage,
  но без support.ticket.create отправка блокируется дополнительным правом.
- Expected: выбранный self-service процесс с вводом допустимых параметров,
  проверкой capability/прав, состоянием подключения и результатом первой синхронизации.
- Влияние: операторская заявка подменяет согласованный пользовательский результат;
  наличие backend integrations не закрывает эту функцию.
- Рекомендация: реализация согласованного ERP UI в соответствующем R3 scope,
  поддержка как исключение. Не менять текст требований под нынешний экран.
- Приёмка: supplier/clinic разрешённые роли; создать/test/revoke подключение,
  invalid credentials, tenant denial, pending/failure/retry, первая синхронизация;
  UI/API/DB evidence с реально выбранной конфигурацией, sandbox внешней системы.
- Решение владельца: бизнес-правило уже принято; конкретные внешние capability
  и конфигурации остаются своими decision gates. Исправление в аудите не выполняется.

### AUD-UI02 — RU/KK реализован отдельными фрагментами, не всем интерфейсом

- Категория: функциональный/локализационный разрыв; severity medium, priority P2.
- Статус: CONFIRMED_STATIC; browser NOT_RUN.
- Требование: PROJECT_OVERVIEW / unified spec — RU/KK; EN отложен.
- Root: `apps/web/app/workspaces/workspace.tsx:61–78` hardcoded RU navigation;
  `orders.tsx:16,36–52` hardcoded RU filters/states;
  `settings.tsx:21–31` читает lang=kk, но передаёт locale только календарю,
  остальные вкладки и fallback/confirmation остаются RU;
  `apps/admin-web/app/admin-shell.tsx:26–40` RU labels/errors.
- Воспроизведение из source: открыть supplier settings `?tab=calendar&lang=kk`:
  календарь KK, соседние tabs/sidebar RU. `?lang=kk` не локализует orders shell.
- Expected: согласованный выбор языка сохраняется при переходах и покрывает
  navigation/forms/states/errors/accessible names/date and currency presentation.
- Влияние: пользователь KK получает смешанный язык; scoped П01/П02/П03 KK PASS
  нельзя считать глобальной приёмкой языка.
- Рекомендация: отдельный план покрытия RU/KK без изменения дизайн-системы;
  объединить источник locale и перевести существующие surfaces по матрице.
- Приёмка: реальные KK routes/состояния, long text, keyboard/accessible names,
  reload/navigation persistence и backend error translation; RU regression.
- `html lang=ru` не записан отдельным дефектом: локальные KK-компоненты имеют
  собственный lang, а окружающий текст сейчас действительно RU.

### AUD-UI03 — причина блокирующей ошибки загрузки исчезает по таймеру

- Категория: UX/error recovery; severity medium, priority P2.
- Статус: CONFIRMED_STATIC; ожидает browser503/таймер для runtime evidence.
- Требование: DESIGN_SYSTEM.md:560–565 — блокирующие состояния используют
  `presentation="inline"`, recovery остаётся доступным.
- Root/consumers: `workspaces/cart.tsx:88–98` при initial error/no data возвращает
  ErrorState без presentation; `orders.tsx:43` делает то же для списка.
- Shared chain: `packages/ui/src/primitives.tsx:282–294` default toast →
  `action-feedback.tsx:27–28` в provider возвращает только recovery action →
  `save-toast.tsx:96–101` убирает notice через5220ms.
- Actual: причина недоступности начальной загрузки видна временно, затем остаётся
  кнопка «Повторить» без постоянного объяснения. Ошибка не устранена таймером.
- Expected: причина и контекст блокировки остаются до успешной загрузки/ухода;
  retry не исчезает, данные не имитируются пустыми.
- Приёмка: isolated initial GET503, wait>5.3s, текст причины и retry остаются;
  retry success возвращает контент, keyboard focus сохраняется; обе роли/phone.
- Исправление: targeted caller presentation=inline по состоянию, не глобальная
  отмена принятого toast feedback и не переделка всех ошибок.

### AUD-UI04 — контраст placeholder в hover-состоянии ниже 4.5:1

- Категория: accessibility; severity low, priority P3.
- Статус: CANDIDATE_STATIC, нужна runtime computed-style проверка.
- Root: `packages/ui/src/styles/controls.css:22–33`: placeholder text.muted
  `#607169`, opacity1; hover control background surface.hover `#EAF0ED`.
- Расчёт WCAG relative luminance по двум JSON hex: **4.4754:1**, ниже4.5:1 для
  обычного текста. Речь о placeholder, не disabled control. Наличие label не
  отменяет требование контраста к отображаемому placeholder.
- Для сравнения text.muted на surface.subtle даёт4.66; brand.soft4.5139.
- Expected: фактически отображаемый placeholder/control pair проходит4.5 во
  всех применимых состояниях, включая hover.
- Приёмка: computed foreground/background/opacity/font на обычном DmInput и
  DmTextarea в браузере; уточнить CSS specificity. Если цвета совпали — исправлять
  shared semantic contract только отдельной согласованной задачей с representative
  consumers, не локальным override.

## Дополнительная проверка admin/forms/денег

Статически просмотрены operations-workspace/admin-shell/admin-section-components,
use-admin-access, use-operator-projection, operator-orders/detail,
operator-document-exception, use-signing-admission-review, platform-settings,
operation-assignment и integration editor; shared manual-payment-panels,
commerce-analytics, document-detail-panel и controls. Полного runtime PASS нет.

- Admin имеет10 nav sections: analytics, overview, organizations, access, catalog,
  imports, orders, support, security, settings. Компоненты lazy loaded с loading.
- Operator order/detail remount по key=orderId: предварительная гипотеза о показе
  старого заказа при изменении URL **отклонена**, key не даёт перенести старую data.
- Projection при401/403 очищает data, при transient error сохраняет прежнюю;
  PlatformSettings явно помечает stale/partial/profile mismatch, не выдаёт нули.
- Operator detail различает заявленный перевод и подтверждённое поступление;
  отсутствие paymentSummary отображает «Подробная сверка недоступна».
- PaymentSummary считает возвраты через BigInt, отдельно показывает переплату,
  не приравнивает квитанцию к деньгам. Это source review, не бухгалтерская приёмка.
- CommerceAnalytics честно пишет «Не учитывается» для cash/debt и предупреждает
  о полноте истории; отсутствие cash settlement уже функциональный gap, не новая
  ошибка «нулевого долга». Есть timezone/date validation, bounded93дня, empty/retry.
- Signing review сохраняет uncertain command/idempotencyKey для повтора, отдельно
  проверяет evidence/file/note; source review не доказывает ЭЦП/юридическую готовность.
- DmField/Select/Input используют Fluent controls; native-compatible DmSelect
  ещё существует для form data. Его presence само по себе не объявлено дефектом
  без конкретного требования смены данного legacy consumer.
- Document registry имеет inline error/retry, keyboard close/restore, linked versions,
  signature status и accounting reason. Старый DocumentArchiveTable Enter bubbling
  не внесён в находки unified UI: текущий маршрут использует DocumentRegistry.

Числовая статическая проверка semantic pairs (не screenshot/computed PASS):
text.primary/default16.64; text.secondary/subtle6.16; text.muted/subtle4.66;
white/brand5.35; white/success5.31; white/danger6.49; white/info6.90;
text.primary/warning.toast10.23; focus.ring/default5.35.

## План браузерного покрытия

Все записи ниже до выполнения — NOT_RUN. Проверки только после подтверждения
изолированных API/frontend/fixtures координатором; не использовать рабочий dev.

| Группа | Основные проверки | Viewport / locale / роль |
| --- | --- | --- |
| Public→product→personal cart | поиск/filter/reset, empty/error/retry, quantity, changed terms, no fake checkout | 1440RU,390KK; anonymous/personal |
| Shell | skip link, mobile menu open/Escape/return focus, no hidden Tab targets, profile/bell | clinic/supplier1440/390 |
| Orders | filters/pagination/detail, payment-proof requirement, deadline/notifications, error recovery | обе стороны RU/KK |
| Settings | calendar invalid values/503/retry/draft; sources actual outcome; modal close/focus | supplier editor/read-only390/1440 |
| Documents/support | table/drawer keyboard, filters/loading/empty/error, upload validation, draft retention | clinic/supplier |
| Operator | section navigation, filters, selected object/dialog, denied permissions, errors | operator1440/390 |
| Cross-cutting | zoom200%, reduced motion, long strings, computed styles/contrast, screenshot | репрезентативные consumers shared controls |

Существующие specs: `workspace-rebuild`, `settings-profile`, `public-catalog`,
`documents-registry`, `support-workspace`, `messages-workspace`, `catalog-layout`,
`catalog-navigation`, `catalog-reference`, `catalog-performance`, `workspace-list-volume`.
Наличие spec не равно PASS; strict mock и реальные API/DB tests различаются.

## Ограничения и следующий шаг

Не измерены runtime contrast/overflow/computed styles, 200% zoom, actual keyboard
и browser locales. Не запускались собственные app/tests/servers. Нужно дождаться
подготовленного стенда координатора, исполнить доступную матрицу и дополнить этот
артефакт ссылками на logs/screenshots и точной версией. Статический этап не закрывает
UI/UX часть комплексного аудита.
