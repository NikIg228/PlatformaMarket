# CATALOG-LAYOUT — компактный каталог

Владелец: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1. Состояние: blocked (остаток browser acceptance).
Основание: запрос владельца28.09:4 колонки+фильтры240px, компактные карточки,
операторское название, серверные фильтры, sticky существующий header.
Canonical main@26edf45afcba07a9c67cfa951c3f322853d8ec40; один writer.
Предшествующий dirty scope FRONTEND-DEMO/INTERNAL-PILOT сохранён, не принят
этой задачей. Оплаты, интеграции, массовые изменения данных исключены.
Прочитаны Workflow/context, UI standard; применяются ранее прочитанные
Frontend Developer, UI Designer, Code Reviewer practices. Новых агентов нет.

Найдено: отдельного названия нет; операторский PATCH имеет version/audit.
Часть фильтров page.tsx применяется только к загруженной странице; исправить
на серверную выборку с согласованными total/пагинацией. Деньги — строки/Decimal.
DoD: требования карточки/фильтров/URL/back/header и операторского поля проверены.
Gates: typecheck, unit, builds затронутых apps, core-contract, Prisma validate и
upgrade на disposable audit DB при миграции, целевые browser1280/390.
Попытки новых gates0. Прежний общий web gate blocked на отложенном invoice-upload;
не повторять его и не объявлять всю сборку/пилот принятыми. Публикация до PASS
обязательных gates заблокирована; CI не запускался.
Dev launcher session90163 из canonical root, JWT/audit DB; перед остановкой
проверить источник. Следующий шаг: контракт полей и серверных фильтров.

Реализовано (проверки продолжаются): nullable Product.catalogName + operator PATCH
с существующим version/audit; API отдаёт catalogName/manufacturerSku. SALE_UNIT
режим поиска считает актуальную минимальную доступную цену того же набора
предложений в SQL до total/offset, сохраняет прежний NORMALIZED режим.
Опции фильтров по всему доступному каталогу, включая category attributes.
CompactCatalog вынесен из route, URL хранит IDs/attributes/count; sticky header
измеряет высоту через ResizeObserver, панели ограничены viewport.
Prisma validate/generate PASS; migrate deploy PASS только проверенный audit DB,
добавлен nullable столбец без обновления существующих карточек.
typecheck1 FAIL BigInt literal/старый target;2 FAIL поле ошибочно добавлено в
create вместо update, исправлено; третья ещё не запускалась. unit1 FAIL:
SSR Fluent tabster import и order-profile timeout5s под нагрузкой. Карточка
выделена в самостоятельный компонент без Fluent; повтор serial после build.
build1 API/admin PASS, buyer RUNNING session41430. Dev90163 остановлен Ctrl-C.
Следующий шаг: закончить build, unit/typecheck и реальный browser/API gate.

Gates: build1 PASS6/6 (schemas/client/ui/API/admin/buyer, bundle budgets).
unit2 serial PASS11/11; typecheck3 PASS12/12. API build2 PASS после добавления
родительской категории в ответ; contract1 PASS (35 core operations,35 response
checks в стандартном verifier, каталог50/предложений500). Browser1 RUNNING,
новый scoped config catalog-layout, размеры1280/1600/390 и API/edge tests.
Dev97057 JWT canonical запущен, все4 приложения ready. Preflight SALE_UNIT+
filterOptions: total50, brands8, HTTP200. Платежные сценарии не запускались.
Дополнительные frontend fixes после build1: безопасный parse attributeFilters,
единый exact money parser и сохранение мобильной панели при загрузке клиники.
Они требуют финального buyer build. Browser source использует эти fixes.

Browser1:1280 прошёл layout/return48/sticky, остановлен на ошибочном тестовом
getByLabel для native select. Прочитан screenshot/trace; опции API присутствуют.
Исправлен locator на combobox accessible name; повтор2:1280/1600/390 + API
sale price/range/supplier/page PASS4/4. Edge photo/SKU/price/title/focus PASS,
последний assert API error FAIL из-за второго Next route-announcer alert;
locator сужен до region каталога. Error UI фактически виден на screenshot.
Browser3 запланирован только edge и header controls/clinic mobile panel;
предыдущие4 PASS переиспользовать. Оставшиеся изменения после2: legacy brand/
category URL фильтры серверные, удалён неиспользуемый локальный page-only filter.
Дополнен OpenAPI operator PATCH request/response/errors и typed client,
используемый новым полем админки. Это завершение исходного contract scope.
Build completion PASS6/6; contract3 PASS104 schemas/35 core operations,
response/error validation PASS. Финальные unit/typecheck ещё выполняются.
Dev97057 остановлен для сборки; перезапустить после static gates.

Последние проверки после typed operator API: completion-build6/6 PASS,
completion-unit11/11 PASS (serial), completion-types12/12 PASS. Логи:
outputs/internal-pilot-20260928/catalog-contract-completion-*.log.
Все input-changing fixes охвачены; последующие docs/read-only не требуют rerun.
Новый APIclient test подтверждает сохранение huge exact minor amount и version/
catalogName-only PATCH. Данные существующих товаров не изменены.

Финальная browser receipt: run2 PASS4 (1280/1600/390 catalogue + live API
price/range/supplier/pagination). run3 PASS edge missing image/SKU/price, full
long name/category, keyboard focus, API error versus empty. Два новых clinic
header cases FAIL: fixture остался гостем, поэтому меню кабинета отсутствовало.
Причина test setup: fixture без JWT_SECRET использует published e2e key, dev
launcher использует .tmp/local-runtime/jwt-secret через localAuthConfig.
Scoped Playwright config теперь читает ключ того же dev runtime без вывода
значения. Product auth/guards не менялись. Четвёртый browser run НЕ запускался
по лимиту AGENTS/Workflow; не выдавать5/7 за полный PASS. Поиск/город в этих
сценариях дошли до меню; кабинет и clinic mobile panel остаются непроверенными.
Следующий точный шаг после разрешённого продолжения: на текущем dev82593
повторить только --grep 'sticky header controls' с исправленным config,
переиспользовав остальные5 PASS и статические/contract/build evidence.
Если inputs изменятся, проверить их до reuse. Прежний deferred payment web
blocker не возобновлять. Commit/push НЕ выполнялись, main@26edf45, CI NOT_RUN.
Dev82593 оставлен работающим из canonical root, JWT/audit DB, все4 приложения.
Оператор должен вручную утвердить короткие названия; характеристики-фильтры
показываются только при существующих filterable данных. Без массового backfill.
Скриншоты desktop/mobile сохранены в outputs/internal-pilot-20260928/catalog-*.png.
Применены Frontend Developer/UI Designer/Code Reviewer и Playwright trace/
snapshot practices; обязательные регрессии — в существующем @playwright/test
по project AGENTS, без новых библиотек и без отдельных агентов.

Финальная квитанция: e2e config typecheck PASS; git diff --check PASS. Dev admin3000/buyer3001/supplier3002/landing3003 HTTP200. Source hashes: outputs/internal-pilot-20260928/catalog-source-hashes.json. После исправления fixture browser не запускался; статус остатка сохраняется blocked.
