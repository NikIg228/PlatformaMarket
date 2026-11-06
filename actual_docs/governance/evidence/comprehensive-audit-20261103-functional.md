# Функциональная сверка PlatformaMarket 03.11.2026

База: `main@4543fd22c92464bb72fe75a627bb225adb921fde`. Продуктовый код этим
направлением не менялся; suites, серверы и БД не запускались. Изменены только
[матрица187 правил](comprehensive-audit-20261103-requirements.csv), этот отчёт и
разрешённый координатором отдельный диагностический файл freshness-race.mjs.

## Как читать результат

Все187 строк получили результат **разбора и сопоставления**, а не общую приёмку:
116 `STATIC_MAPPED_PARTIAL` — найден и выборочно прочитан соответствующий путь,
но полное поведение правила не доказано;34 `STATIC_DECISION_DEPENDENCY` — правило
зависит от незакрытого решения/внешнего входа;11 `DELEGATED_EVIDENCE_LIMITED` —
платформенные вопросы переданы профильным направлениям. Остальные статусы отражают
конкретный разрыв, документальный drift или ограниченно реализованную часть.
Отсутствие `NOT_REVIEWED` **не означает**, что все187 правил протестированы.
`runtime_result=NOT_RUN` относится к этому исполнителю; фактические запуски
координатора перечислены в [общем evidence](comprehensive-audit-20261103.md).

Колонки `source_*_not_revalidated` сохраняют исходный срез02.11. Он может расходиться
с уже исправляемыми координатором документами03.11. Например, П01–П03 больше не WIP,
V15 выбран, V16/V17 не выбраны. `audit_note` задаёт уточнение данной проверки.
Ссылки на каталоги в `independently_inspected_code` означают инвентаризацию границы,
а не построчное чтение каждого файла каталога. Тесты в CSV — кандидаты/источники
покрытия, их наличие не присваивает правилу PASS.

## Сопоставленные функциональные границы

| Область | Прочитанный путь и вывод | Что ещё нужно для полного результата |
| --- | --- | --- |
| ACC/B2C | PersonalCartController: owned CRUD, validate/reprice; checkout route отсутствует. AuthSessionsController содержит email/social/session, но не завершённый phone-login путь. SigningAdmissionService submit/queue/review создаёт operator-reviewed authority | Самостоятельный B2C checkout/payment/receipt; реальный phone/social recovery; подтверждённый источник директора и делегирование |
| CAT | SupplierOffer/ProductVariant/packaging и каталог отделены; DataFreshnessService/InventoryFreshnessService работают с минутными policies | Рабочий календарь ручного наличия, категорийные/медийные правила, complete reorder/lists/compare journey |
| ERP/import | AdapterRegistry выбирает MOYSKLAD/CUSTOM_API/MOCK, ONE_C выполняет внешний агент. IntegrationJobs использует `FOR UPDATE SKIP LOCKED`, claim/release/stale recovery; worker tick3s, retryable/permanent errors. ImportsService содержит preview, processRow, rollback | Полезный live first-sync выбранной конфигурации; self-service unified UI; field authority и echo-loop для нового CRM контракта; точный AI-provider/quality workflow |
| CART | Core checkout сохраняет supplier split и snapshot, но reserveForOrder остаётся до оплаты. PersonalCart не запускает checkout | Новый P1 без резерва, paid-part allocation, legacy upgrade и B2C |
| AGR | OrderWorkflow.execute: order lock, version, actor/idempotency, audit/outbox. Отдельные reduction и manual-return. OrderResponseService45/60/120 и календарный snapshot существуют | Полная новая версия предложения24ч, payment/shipment hold,12ч reminder, отдельные paid-part choices/expiry/escalation |
| PAY | Merchant onboarding guards, intent allocations и operation attempts существуют. Manual transfer отделяет claim от confirmation. Generic settlement не равен выбранным P2–P7 | Реальные методы/merchant/recipient/payer, unknown recovery, receipt/refund и прямые расчёты выбранного банка; no proof-file requirement по новому правилу |
| SHIP | Logistics.createShipment требует PAID; supplier transition не может поставить DELIVERED. DELIVERY/PICKUP step completion запрещён поставщику; итог требует delivered quantities | Реальные перевозчики, fixed quote/payees, booking/reconcile/cancel, B2C recipient/OTP и отдельная услуга доставки |
| DOC | Invoice locks requisites, version/checksum preview, immutable confirm. Waybill preview по партии. SignatureAdapterRegistry в nonproduction может вернуть mock | Полная матрица originals/сторон, live NCA/authority/revocation, mobile return/unknown, B2C документы и закрытие обязательств |
| FEE | goodsCommission: bigint `(net+5)/10`, receipt/return delta; analytics применяет tenant/dataset/currency до totals | Месячный комплект,5раб.дней, cash/allocation/credit/dispute/debt/overdue; принятый V15 не реализует бухгалтерский процесс автоматически |
| AGENT | В main schema/modules поиск referral/attribution/reward не обнаружил агентскую программу; ConnectorAgent — ERP-процесс | Атрибуция поставщика,90суток от receipt, ставка, месячная сверка/выплата, возвраты/налоги/договор |
| TRUST | PromotionTerms/price-history30days/version/moderation и review eligibility находятся в профильных сервисах/тестах | Полная новая комбинация quantity tiers/stacking и принятие правил appeal/rating; scoped gift-PG не закрывает весь TRUST |
| COM | Conversations.start/send привязывают контекст/стороны; notification idempotency/retry/inbox существуют | Реальные delivery receipts каналов и opt-out; отдельный Organization↔Business bridge и двусторонняя live сверка |
| ADM | Operator services/tests доступны; analytics cash/debt остаётся null, historyComplete=false | Полный operator UI и finance expenses/profit; отдельные grants/основания санкций |
| OPS | Отдельные [UI](comprehensive-audit-20261103-ui.md) и [runtime/mobile](comprehensive-audit-20261103-runtime-mobile.md) результаты | Native/device/Linux/Yandex/live evidence в пределах фактически доступной среды |

## Существенные разрывы и кандидаты

| ID | Класс / серьёзность | Доказательство и expected/actual | Рекомендация и приёмка |
| --- | --- | --- | --- |
| AUD-FUNC01 | Known requirement gap, high product impact | `commerce.service.ts:700–706` создаёт резерв с ttl30мин. CART-04/PAY-03 требуют7календарных дней без резерва до оплаты | П1 policy version и legacy path; PG доказывает отсутствие резервирования до денег, stockout не уничтожает денежный факт |
| AUD-FUNC02 | Known requirement gap, medium | `order-workflow.service.ts:161–168` требует documentId, PAYMENT_PROOF, совпадение суммы/валюты. PAY-02 допускает заявление без файла | Optional proof в schema/API/UI, новый business dedup без file-id, сохранение состояния «на проверке» |
| AUD-FUNC03 | Known financial scope gap, high | `payments.service.ts:58` пишет MARKETPLACE_PERCENT200bps, settlement пишет platform_fee revenue; `commerce-metric-facts.ts:12–15` отдельно начисляет10%. Это разные старый и новый контуры, не доказательство реально взысканных12% | Не менять200→1000 механически; отдельно согласовать provider fee, platform accrual/cash; сквозной receipt/refund пример без двойного дохода |
| AUD-FUNC04 | Known implementation gap, high | `commerce-analytics.service.ts:20/75`: cash/debt=null, historyComplete=false. Unknown показан честно, но FEE03–08/ADM08 не исполнены | Месячный ledger/allocations/credit, late return и dispute; повтор/гонка не удваивают cash; due стартует после комплекта+отправки |
| AUD-FUNC05 | Confirmed concurrency defect, medium | `inventory-freshness.service.ts:20–28` вычисляет устаревших кандидатов вне транзакции; :36 пишет STALE только по id. Два реальных Prisma connections воспроизвели: новая future expiry сохранена, но статус перезаписан STALE, публикация PAUSED | Recheck актуального freshness/version внутри lock/CAS; interleaving regression: обновление connection2 после snapshot connection1 сохраняет FRESH и PUBLISHED |
| AUD-FUNC06 | Known freshness gap, medium | `data-freshness.service.ts:36–38` и `inventory-freshness.service.ts:25` fallback MANUAL48h/IMPORT24h/ERP15min. Это не CAT-13 «каждый рабочий день+24ч уточнения» | Привязать freshness к принятому рабочему календарю и явно отделить stock verification от response SLA |
| AUD-FUNC07 | Known integration gap, high product impact | Unified sources UI создаёт заявку специалисту (AUD-UI01), а не обязательный self-service; main adapter registry не содержит отдельного CRM bridge | Self-service обеих ролей, полезный first-sync и recovery; выбранная CRM capability matrix; не обещать «любая1С» |
| AUD-FUNC08 | Known mobile/release gap | Main не содержит найденный native Market срез отдельной ветки; это не доказательство отсутствия mobile вообще | См. runtime/mobile report; merge/checkout/build не разрешены этим статическим направлением |

AUD-FUNC01–04 ранее известны и открыты в roadmap; это не новые security findings
и не ошибочно закрытые задачи. AUD-FUNC05 подтверждён отдельным запуском координатора
03.11 (`freshness-race-result.json`, attempt1). Диагностика `.tmp/comprehensive-audit-20261103/freshness-race.mjs`:
точный guard auditDB, два Prisma connections, собственный supplier/product/offer/balance,
барьер после чтения кандидатов, фактическая запись второго connection, штатный compiled
service, отчёт expected/actual и cleanup. `node --check` PASS; исполнение завершено,
fixtures очищены. Диагностика не подменяет код сервиса и не ослабляет его проверки.

## Межпроектная граница

ТЗ §23 требует проверенной Organization↔Business связи, optional consent, source
id/version/checksum/event key, revoke и отсутствие повторного дохода. Main integration
registry обслуживает ERP generic adapters и ONE_C agent; наличие таких адаптеров не
доказывает весь новый CRM↔Market контракт. Market finance не должен экспортироваться
в CRM. Соседний репозиторий этим направлением не изменялся и не аудировался; counterpart
runtime и совместная доставка событий здесь **NOT_VERIFIED**, не «контракт совместим».

## Порядок исправлений и проверка

1. Сначала реальные дефекты существующих путей из общего реестра: connector HTTP
   composition и freshness race после подтверждения. Не смешивать с новыми продуктами.
2. P04/order proposal и P1/paid-part: общий request/response/state contract, lock/order
   races и legacy upgrade; API+UI вместе. Финальная доставка до оплаты обязательна.
3. P2–P7 и доставка: выбранные внешние sandbox capabilities, точные получатели денег,
   unknown/reconcile/duplicate/refund и отсутствие постоплатной доплаты.
4. Комиссия/агенты: statement/accrual/cash/credit/debt отдельно, source facts,
   закрытый период, поздний возврат и replay. Принять оставшиеся внешние решения.
5. Документы/директор/CRM/mobile: live authority, exact bytes, revoke/recovery;
   identity linking и data ownership доказать контрактными и реальными sandbox тестами.

В каждом пункте минимальная приёмка: happy path, invalid input, role/tenant denial,
конкурентный повтор/устаревшая версия, rollback и recovery; reachable UI со всеми
значимыми состояниями. Unit+mock не выдаются за внешний/live/device результат.
Parent runtime logs остаются источником новых PASS/FAIL; наличие теста или эта таблица
не закрывают roadmap. Product acceptance и production readiness остаются открытыми.

## Проверка самого evidence и оставшиеся гипотезы

CSV перечитан после заполнения: 187 уникальных `rule_id`, нет пустых code/test/UI/note
ячеек; все файловые ссылки в code/test колонках существуют после снятия номеров строк.
`git diff --check` для двух файлов не сообщил ошибок. Групповые ссылки в
`STATIC_MAPPED_PARTIAL` намеренно обозначают соответствующую функциональную границу,
а не индивидуальную доказанную реализацию каждой строки. Исходные статусы требований
сохранены отдельно и не превращены в PASS.

Уточнение документации04.11: AUD-FUNC05 уже проверен probe03.11 (attempt1),
результат FAIL сохранён выше. Прежняя итоговая фраза «до результата probable»
была устаревшей. Последующее исправление и отдельные проверки —
[цикл остатков04.11](stock-quantities-20261104.md); они не заменяют исходный FAIL. Для остального
перечня AUD-FUNC01–04/06–08 отсутствие нового runtime не превращает известный
продуктовый gap в регрессию. Реальная комиссия в12% **не подтверждена**: её нельзя
заявлять на основании отдельного200bps allocation и10% аналитического начисления.
Полный live B2C/payment/carrier/NCA/CRM/agent outcome здесь не проверен; отсутствие
выбранного внешнего входа или реализации нельзя закрыть общим unit/PG/browser PASS.
