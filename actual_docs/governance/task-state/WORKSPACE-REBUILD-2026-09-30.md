# WORKSPACE-REBUILD-2026-09-30

Владелец: текущая side conversation, явное поручение пользователя переписать
кабинеты клиники и поставщика; подтверждён утверждённый состав и сохранение API.
Остальные задачи проекта idle при preflight. Canonical main, HEAD646dab5;
существующий общий WIP сохраняется, публикация не входит в текущий scope.

Scope: новая навигация и отдельные страницы клиники (каталог, корзина, заказы,
документы, настройки) и поставщика (главная, товары, заказы, документы,
настройки). Общий публичный каталог, авторизация, API и БД сохраняются.
Доменные формы и контрактные проверки переиспользуются: переписывание оболочки
не разрешает удалять проверки версий, tenant, остатков, договора или checkout.

DoD: самостоятельные маршруты/загрузка, loading/empty/error/action feedback,
роль и организация проверяются перед запросами; переходы назад/прямые URL;
адаптивная общая оболочка Fluent UI. Проверки: targeted unit, typecheck,
npm test (известный прежний blocker Tabster), diff --check и scoped UI smoke.
Записи проверки только в disposable test DB. Max3 попытки на blocker.

Статус: локальная реализация есть; общая приёмка BLOCKED существующим unit gate.

Реализовано:
- apps/web/app/workspaces: общая верхняя навигация, verified-session context,
  отдельные controllers и routes для обеих ролей, page-level error boundary.
- Клиника: /clinic/cart, /clinic/orders, /clinic/documents, /clinic/settings;
  /clinic сохраняет прежний переход к корзине; каталог остаётся публичным.
- Поставщик: /supplier, /supplier/products, /supplier/orders,
  /supplier/documents, /supplier/settings. Создание/редактирование/публикация
  предложения, импорт, подтверждение заказа, отгрузки, договор/реквизиты/документы
  через действующие доменные формы и API. Старые монолитные страницы больше
  не подключены к unified routes; их исходники нужны legacy и public catalog.
- Order detail использует общий workflow с правильным обратным адресом;
  optional buyer/offer не обрушает новый экран. Договор доступен гостю по
  /supplier/legal/* как прежде. Новые безопасные returnTo routes разрешены
  только для соответствующей роли, action URLs не разрешены.
- Изменений HTTP API, миграций, БД и пользовательских данных нет.

Evidence:
- npm run typecheck: PASS 13/13; итоговый log outputs/workspace-rebuild-typecheck-final.log.
- npm run build --workspace=@marketplace/schemas: PASS (новые returnTo в runtime).
- focused schemas product-navigation/workspace-pages: PASS40/40.
- Playwright playwright.workspaces.config.ts: PASS7 уникальных UI сценариев
  с полностью перехваченным API, без записей в dev DB. Навигация/reload,
  независимые ошибки, документы, mobile390, guest gate, cart reprice/checkout
  idempotency, supplier confirmation/backlink. Это UI integration, не полный
  end-to-end с настоящей БД. Первоначальный guest locator ошибочно искал heading
  вместо strong в ErrorState; исправление теста — PASS на попытке2. Order-detail
  fixture выявила optional buyer crash; fallback — PASS на попытке2.
- Скриншот outputs/workspace-rebuild-order.png просмотрен; после просмотра
  локально добавлены внутренние отступы в order sections.
- npm test: FAIL прежнего compact-catalog.test.tsx:
  tabster does not provide an export named createTabster; 11/12 tasks successful,
  buyer90 assertions PASS, collection1 FAIL. Log outputs/workspace-rebuild-unit.log.
  Третья совокупная попытка этого blocker вместе с DEV-RECOVERY; больше не повторять.
- git diff --check PASS. Никакого commit/push; main646dab5 и общий WIP сохранены.
- Полный verify:web/DB-writing suites NOT_RUN: активный dev на рабочей marketplace,
  в этой задаче применены изолированные browser route fixtures.

Практики: ранее прочитанные Agency Frontend Developer, UI/UX roles и проектный
UI standard: feature decomposition, общие Fluent primitives, состояния,
keyboard navigation, transactional version/idempotency сохранены.
Dev session25156 оставлена работающей, frontend HMR подхватил routes.
Следующий точный шаг для полной приёмки: отдельное устранение существующего
Tabster/Vitest blocker с новым основанием для проверки; затем реальные critical
flows на disposable test DB. Не перезапускать всю диагностику без новых входов.

## UI follow-up: левый сайдбар

30.09 пользователь явно поручил вернуть расположение навигации слева и стиль
каталога. Scope только shared workspace shell/CSS; API/доменные controllers
не меняются. Единственный writer — эта side conversation; остальные задачи
idle при проверке. main646dab5, прежний WIP сохранён.

Реализованы фиксированный левый sidebar256px (224px на узком desktop),
логотип каталога, название организации из проверенной сессии, роль, иконки
Fluent, активная ссылка, выход внизу. На mobile раскрываемое меню с Escape,
возвратом фокуса и закрытием после перехода. Мягкий фон взят из publicStore,
белые карточки/рамки/зелёные ссылки согласованы с каталогом.
Название приходит из organization.displayName через auth-sessions.service;
«Демо поставщик01» не захардкожено в UI. Данные не редактировались.

Scoped browser PASS5: clinic navigation/геометрия, supplier routes, documents,
mobile, sidebar session name/desktop/keyboard dismissal. Route fixtures,
без обращения к рабочей БД. Screenshots outputs/workspace-sidebar-desktop.png
и workspace-sidebar-mobile.png просмотрены. Typecheck web PASS после замены
неподдерживаемого ref на DmButton обычным id для фокуса (попытка2).
Прежний общий unit Tabster blocker не изменился, повторный npm test NOT_RUN
по исчерпанному лимиту. Commit/push не выполнялись.
Итоговый npm run typecheck PASS13/13 (11cached), log
outputs/workspace-sidebar-typecheck-final.log. git diff --check и проверка
пробелов новых файлов PASS. UI follow-up локально завершён; общий прежний
blocker полного test suite остаётся. Dev работает, новых серверов не создано.
