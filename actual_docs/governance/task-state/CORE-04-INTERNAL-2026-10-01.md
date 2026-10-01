# CORE-04-INTERNAL — согласованные акции и сохранение условий заказа

01.10.2026 CI_PASS / DEV_PENDING_APPROVAL. Единственный writer:
primary01a0f302-2d38-75d1-b79c-141e7428b533. Canonical root, main@ab3992e.
Основание: внутренняя очередь Foundation6.2 и «продолжай» после CORE03.
CORE03 CLOSED/CI_PASS/DEV_RESTORED; его checks не повторять.
Пять исходных WIP сохранены; другие worktrees/агенты не создавать.

## Граница и DoD

Только CORE04.6–04.7 по Product23.3/23.6: предложение поставщика со скидкой
или N+M, неизменяемые версии/исходная цена, история30 дней и предупреждение
о повышении, решение оператора/причина/версия, временное состояние отдельно.
Одна акция на предложение, без суммирования; резервы основного товара и
подарка, сохранение обещания при split delivery, пересчёт с согласием клиники,
история в заказе, текущие условия при reorder. Витрина/фильтруемый список,
supplier history/template→новый draft. Реальные акции/банковские операции,
новые интеграции, legal launch и автоматическое расписание вне scope.
CORE04.1–04.5 уже приняты и не переписываются.

ADR011: promotions только go_live, pilot API/client/UI остаются ограниченными.
Использовать существующие Promotions/Commerce/Inventory/Fluent границы;
общие schemas→контракт→реализация→клиент→UI. Без второго design system.

Inventory: существующий PromotionsService имеет discounts/coupons/free-shipping,
прямую supplier activation и redemption вне checkout. Нельзя считать это
версией/moderation или резервированием подарков. Cart snapshot/reprice/consent,
order lock/receipt, inventory reserve/compensation уже существуют — расширить
минимально. Обычные цены имеют несколько writers, блокировка должна охватывать
manual/import/integration и не зависеть только от UI.

Gates: schemas/unit/typecheck; Prisma validate и additive migration upgrade;
PG money/stock/gift/partial/replay/race/tenant/price-lock; core-contract/runtime;
pilot build/budget/browser и отдельные go_live buyer/supplier/operator flows
с настоящим API на synthetic disposable audit DB. Desktop/390 и keyboard.
Review/docs/diff, commit/push/фактический CI. Не более3 попыток на gate/блокер;
20мин команда/45мин suite. Новая рабочая миграция требует отдельного scope.

Dev восстановлен по разрешению: launcher4640→dev-local8928,
API1468/4012, web11376/3000, go_live/JWT, health/catalog200. Перед generate/build
остановить только этот собственный запуск, затем восстановить по принятой схеме.

Прочитаны Development Toolkit execution/backend/review, Agency Backend Architect,
Product23.3/23.6, ADR011 и UI standard. Применение: транзакционные/ролевые границы,
сохранение текущего checkout и ясные рабочие состояния. Следующий шаг — additive
контракт версии акции и интеграционный дизайн gift item/accepted snapshot.

## Реализация в работе

Контракты versions/commands/storefront/accepted snapshot добавлены. Additive140000
готовит BUY_X_GET_Y, immutable revisions/decisions, nullable cartItem для отдельного
zero-price gift order item, общую price-trigger защиту всех writers.
Свой dev остановлен после health/catalog200: ancestry4640→8928→API1468/web11376
сверена до taskkill4640/T. Generate/schema build первого контракта PASS;
последующие изменения ещё не проверены. Рабочая140000 не применялась.
Commerce quote/claim/gift reserve/compensation и reprice snapshot в работе;
service/frontend/PG evidence ещё не завершены. Следующий шаг — завершить
роль/витрину/UI и targeted tests до первого полного typecheck.

## UI и промежуточные проверки

Добавлены общий Fluent workspace акции, supplier route /supplier/products/promotions,
operator moderation в разделе каталога; legacy supplier panel использует тот же
контракт. Формы выбирают предложения, создают новую версию/шаблон, оператор видит
исходную цену/минимум30дней/решения и задаёт срок витрины. Public storefront/full
list/product conditions в работе. Поиск скрывает старые несогласованные promotions.
Применены прочитанные Toolkit frontend/verification и Agency Frontend Developer:
loading/error/empty/feedback, native inputs/keyboard, bounded list и lazy feature.

Generate и schemas build №2 PASS (.tmp/core04-generate-2.log,
core04-schema-build-2.log). Первый npm run typecheck PASS 13/13, 67.9с
(.tmp/core04-typecheck-1.log), на промежуточном снимке до public storefront/
productId/giftName/gift relation; финальный изменённый снимок ещё требует typecheck.
Это не закрывает CORE04. Полный unit/PG/build/browser пока NOT_RUN.
Следующий шаг — targeted tests lifecycle/gift/upgrade и проверки final inputs.
Новая140000 по-прежнему не применялась; собственный dev остановлен.
Typecheck №2 FAIL: public API client создан без второго ApiContext argument;
исправлено передачей {}. Unit №1 FAIL: существующая admin dynamic-import проверка
ожидала17 панелей, новая согласованная lazy panel —18; обновлён точный список/
assertion, ограничение lazy loading сохранено. Unit №2 запущен с
--continue=dependencies-successful для полного отчёта независимых пакетов.
Typecheck №3 пока не запускался. Логи .tmp/core04-typecheck-2.log,
core04-unit-1.log и core04-unit-2.log. Генерация №3/schema build PASS.
Unit №2 завершён FAIL: только checkout-snapshot.spec.ts (9), остальные пакеты
PASS. Причина: новый promotion quote читает профиль environment, а прежняя
unit fixture не задавала runtime config. Fixture теперь явно pilot, без обхода
production guards. Дополнительно review выявил сравнение promotion через
JSON.stringify: JSONB меняет порядок ключей. Заменено сравнением полей, добавлен
регрессионный тест JSONB/key order. Последний full unit №3 после стабилизации
PG/UI входов. API build №1 PASS; после изменения shared comparator пересобрать.
PG №1 FAIL после PASS upgrade/предыдущих доменов: новые promotion buyer indexes
81–86 пересекались с существующими fixtures других helpers (unique user email).
Сверен полный список; выбраны свободные51–56. Product assertions ещё не достигнуты.
Добавлены nonstack CONTRACT/TIER и split shipment gift checks в тот же helper.
Для PG №2 build inputs не менялись после завершённого alias build; запуск underlying
через тот же disposable wrapper переиспользует schemas/API artifacts №1.
PG №2 FAIL: Prisma $queryRaw не десериализует PostgreSQL void результата
pg_advisory_xact_lock. Исправлено: SELECT 1 FROM pg_advisory_xact_lock(...),
блокировка сохранена, возвращается поддерживаемый integer. Test upgrade140000
PASS; уже применённый в disposable DB migration не редактировать. Следующий
PG №3 — последняя разрешённая попытка, после нового API build. Все предыдущие
helpers прошли, новые assertions остановились на create до изменения promotions.
Также manual price guard согласован с trigger по approvedRevision/exhausted limit.
Unit №3 PASS:12/12 tasks, API93 files/466 tests, весь graph90.9с.
PG №3 PASS: exact additive upgrade, moderation/versions/tenant/history/min30,
all-writer price trigger, placement/template, nonstack, consent, gift reserve,
replay, bilateral gift reduction, reorder, race/compensation, split shipment.
Предыдущие mandatory PG scenarios также PASS, parent fixture cleanup successful.
Логи .tmp/core04-unit-3.log / core04-postgres-3.log; API build№2 PASS.
Следующий шаг — browser UI и profile-specific build; рабочая БД/140000 не тронуты.
Typecheck №3 PASS13/13 (66.2с), включая новые E2E fixture/config. Pilot build№1
PASS7/7 (169.96с), Next types PASS. Core-contract/runtime/production PASS.
Prisma validate№1 FAIL только отсутствующий DATABASE_URL; №2 через штатный
db:test wrapper PASS. Все DB gates только dentmarket_audit_20260914.
Pilot budget№1 FAIL:26JS/1758107raw/475912gzip (лимиты24/1500000/450000).
Причина по import review: PromotionWorkspace export из общего UI index затягивает
редактор/его runtime schema в публичные consumer boundaries. Выделен явный
@marketplace/ui/promotions export, только supplier/operator consumers. Лимиты
сохранены. Pilot browser№1 идёт на неизменяемом build№1; после завершения
новый build/budget проверит изменённый module boundary.
Pilot browser №1 PASS46/46; module boundary fix затем потребовал budget№2,
он FAIL25JS/1617193raw/447042gzip: runtime display helper импортировал Zod.
Pure promotion-snapshot helpers вынесены в отдельный subpath без runtime Zod;
HTTP validation осталась в promotions schema. Schema build№4/pilot build№3 PASS.
Budget№3 PASS24JS/1152759raw/350838gzip, лимиты не менялись.
Targeted snapshot unit PASS4/4; окончательный pilot browser№2 PASS46/46(1.3мин).
Логи .tmp/core04-pilot-budget-3.log, core04-snapshot-unit-1.log,
core04-pilot-browser-2.log. git diff --check PASS. Go_live build№1 запущен,
затем отдельный synthetic real-HTTP moderation/gift E2E desktop/390.
Go_live build№1 FAIL profile mismatch (штатный guard); №2 PASS после явных
DEPLOYMENT_PROFILE=go_live + NEXT_PUBLIC_DEPLOYMENT_PROFILE=go_live.
Final typecheck PASS13/13(69.9с), helper unit4/4. Go_live browser№1 FAIL:
Fluent required label selector; заменён accessible role selector.
Browser№2 desktop assertions PASS через gift order, cleanup FAIL organizationProfile
ссылается на Address; mobile FAIL скрытый desktop navigation control.
Исправлены порядок cleanup и штатный mobile section selector. Визуальный review
выявил отсутствующий includeFilterOptions=true; добавлен параметр и assertions
двух фильтров. Build№3 затем browser№3 — последняя попытка текущего E2E gate.
Остатки собственных первых fixtures удалены штатно на audit DB:12org/12users,
перед удалением проверено отсутствие offers/orders/carts/documents. Рабочая БД
не тронута. Логи core04-golive-{build,browser}-{1,2}, core04-fixture-cleanup.log.

## Итог локальной приёмки — LOCAL_PASS, публикация/CI PENDING

Go_live build№3 PASS; browser№3 PASS2/2(27.6с), desktop1366/390.
Проверены настоящее создание/подача/решение/витрина, supplier APPROVE403,
невидимость pending, категории/поставщики, mechanic filter/Back, keyboard,
checkout10→gift4/zero amount/immutable promise, отсутствие горизонтального
overflow витрины/заказа. Все собственные fixtures и серверы убраны.
Просмотрены screenshots operator/storefront/gift-order обоих размеров в
apps/e2e/test-results. Соседние operator панели показывают отказ ограниченной
тестовой роли; permissions этой фикстуры намеренно только для акций, это не
ошибка moderation. Полная accessibility/real-user acceptance не заявляется.

Окончательный go_live bundle PASS24JS/1152761raw/350836gzip. Pilot artifact
build№3/browser№2 PASS46/46 сохраняется: последняя правка query-параметра
затрагивает только go_live promotions, profile guards и pilot path не менялись.
Финальный full npm test после выделения helper:11/12 PASS, один прежний
buyer order-profile test превысил5000ms на параллельном dynamic import
(transform71.9с). Единственный transient retry только buyer package без
параллельной нагрузки PASS20files/97tests(20.77с); timeout/assertions не менялись.
API93files/466tests, schemas и остальные10 пакетов финального graph PASS.
Логи .tmp/core04-final-unit.log и core04-final-buyer-unit-retry.log.
Финальный typecheck13/13 PASS; после последних test-only изменений
npm run typecheck --workspace=@marketplace/e2e PASS (core04-final-e2e-types.log).

Команды/evidence: npm run typecheck; npm test; npm run verify:postgres
(№3PASS), npm run verify:core-contract (core04-contract-1.log),
npm run verify:runtime-split, npm run verify:production-config; prisma validate
через db:test; npm run build (pilot graph), npm run build --workspace=@marketplace/web
для final pilot/go_live; npm run verify:web; npm run verify:web-bundle;
npm run db:test -- exec -- node scripts/run-canonical-browser.mjs --config
playwright.promotions.config.ts с обоими env profiles go_live. Final diff check PASS.
PG/contract/runtime переиспользуют прошедшие domain inputs; поздний helper split
переместил неизменные comparator/quantity functions, display reader применяется
UI; финальные schema/API unit и real-HTTP E2E дополнительно прошли.

Self-review (без агентов): прочитаны и применены Agency Backend Architect,
Frontend Developer, Code Reviewer, Git Workflow Master и Toolkit execution,
backend/frontend/review/verification. Проверены tenant/role guards, immutable
revision, locks/race/compensation, exact arithmetic, client/OpenAPI alignment,
UI states и module boundary. Блокирующих findings в согласованной границе нет.
Новая миграция additive: Promotion versions/decisions/gift/limit/placement,
nullable cartItem только для zero-price gift, all-writer price trigger.
Неизменённый package-lock, нет новых dependencies/CI workflows/integrations.

Final runtime manifest .tmp/core04-final-source-manifest.json SHA256
6E3B3D79783045A302B78FD43F0C8A367E6D66FD9309FE028C2916347ECC767C;
база main@ab3992e.54 проверенных путей (включая5 docs); исходные registry и
4 legacy next-env не входят. Собственный generated web next-env восстановлен.
Следующий шаг: conventional commit, обычный push origin/main после fetch/FF,
проверить remoteSHA и фактические CI/Security. Рабочая140000 НЕ применена;
после CI отдельное согласование миграции/восстановления dev. CORE05 не начат.

Опубликовано01.10: f14cbe16162de5230c9826b2a7fe94929422f1ca в origin/main,
remote SHA совпадает. CI36874461180 и Security36874461153 IN_PROGRESS,
без повторных запусков. Исходные5 WIP не staged; generated web next-env имеет
нулевой content diff после восстановления. Новая продуктовая фаза не начата.
Read-only preflight рабочей marketplace/public: единственная pending migration
20261001140000_offer_promotion_versions;505products/510offers/0promotions,
нет прежних order items с null cartItem. Миграция не запускалась. Проверенная
операция для отдельного разрешения: только140000, без seed/смены каталога,
затем собственный canonical npm run dev (go_live/JWT) и health/catalog smoke.

## Подтверждённая публикация — CI_PASS / DEV_PENDING_APPROVAL

Код f14cbe16162de5230c9826b2a7fe94929422f1ca опубликован в main.
[CI36874461180](https://github.com/NikIg228/PlatformaMarket/actions/runs/36874461180)
и [Security36874461153](https://github.com/NikIg228/PlatformaMarket/actions/runs/36874461153)
завершились SUCCESS с первой попытки: общий verify (typecheck/unit/build/budget,
контракты/profiles/API/browser), PostgreSQL/authority/backup-restore,
оба api/web container builds, dependencies/storage и CodeQL. CI unit прошёл
без повтора локального timing failure. Запуски не перезапускались.
Итоговая docs-only запись переиспользует этот CI неизменённых runtime inputs;
локальные ссылки58/58 и diff-check PASS. Повторять runtime suites не нужно.

Кодовый scope CORE04.6–04.7 завершён. Dev restoration отдельно ожидает
разрешения140000 по AGENTS§8: операция/schema/target/evidence описаны выше,
рабочая БД не изменялась. Нет своих работающих проверок/API/web, исходные5 WIP
сохранены. CORE05/EXT/production не начинались; task rollover не выполняется.
