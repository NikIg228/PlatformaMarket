# Требования и приёмочные сценарии: аудит03.11.2026

База `main@4543fd22c92464bb72fe75a627bb225adb921fde`. Этот итог заменяет
предварительный инвентарь данного файла. Продуктовые требования не изменены;
реализация, решения владельца и доказательства разделены.

[CSV187 правил](comprehensive-audit-20261103-requirements.csv) содержит источники,
code/API/UI, кандидаты тестов, результаты статического разбора и остаток приёмки.
Все187 сопоставлены;116 STATIC_MAPPED_PARTIAL не означают полную проверку.
34 строки зависят от решения/внешнего входа;11 имеют ограниченное профильное evidence.
Runtime колонка CSV сохраняет границу исполнителя статического направления.
Текущие запуски и найденные дефекты перечислены в [общем отчёте](comprehensive-audit-20261103.md)
и [функциональной сверке](comprehensive-audit-20261103-functional.md).
Ни одна строка не получила полного runtime PASS только по общему suite.

Последние решения важнее исходного статуса02.11: П01–П03 опубликованы и имеют
evidence; V10/V11/V15 выбраны в документированных пределах; V16/V17 не выбраны.
Обязательные будущие исходы, которые ещё не реализованы, не проверяются как будто
они уже существуют. Отсутствие реализации — разрыв, а не успешный тест.

## AT-01–42: итог и границы

Источник каждого ID — [ТЗ §30](../../UNIFIED_SPEC_MARKET_REQUIREMENTS_2026-10-29.md).
Это coverage assessment, не замена исходных сценариев/негативных вариантов.
Shared unit/PG/browser PASS ниже относится к существующему поведению. Полные
новые AT со всеми внешними и будущими условиями не сертифицированы.

| ID / сценарий | Найденное покрытие и результат аудита | Незакрытая приёмка / причина |
| --- | --- | --- |
| AT-01 регистрация/антифрод | identity/onboarding; unit и pilot auth/browser | Внешняя phone/social/anti-fraud цепочка не принята |
| AT-02 автоматический допуск | signing-admission submit/queue/review, operator-reviewed authority | Полный автоматический источник полномочий не реализован/не выбран |
| AT-03 race директора | signing-admission и authority source mapping | Отдельная гонка внешнего источника директора не воспроизведена; live authority недоступна |
| AT-04 multi-tenant/сети | PG tenant/foreign ownership/rollback PASS | AUD-SEC01 session mutation; полная модель сетей новым AT не принята |
| AT-05 identity link/revoke | current/personal session unit coverage | Все social/phone link/revoke combinations и live provider не проверены |
| AT-06 employees | organizations/access-control/signing-admission mapping | Полная delegated authority и mobile device matrix не приняты |
| AT-07 каталог | core-contract search/compare schemas, pilot catalog browser PASS | Полный moderation/media/category контракт и все RU/KK варианты не закрыты |
| AT-08 UOM | schemas/pricing/packaging; PG stock invariants PASS | Полная live ERP UOM mapping и reconciliation не доказаны |
| AT-09 импорт | imports preview/process/rollback paths; PG existing workflow PASS | Режимы replace/merge отсутствуют в текущей create schema; live field authority открыт |
| AT-10 AI/недоверенный файл | AI/import boundary mapping; existing unit/security policy | Prompt injection/confirmation race остаются неполно проверены; sealed security report отсутствует |
| AT-11 ERP | jobs SKIP LOCKED/retries/recovery source; AUD-API01 HTTP reproduced | Standard Bearer defect, self-service gap AUD-UI01, live first-sync отсутствует |
| AT-12 P1 без резерва | AUD-FUNC01 подтверждён source: reserve30min до оплаты | Новая policy/state и legacy upgrade ещё не реализованы |
| AT-13 pending на дедлайне | calendar/SLA и lifecycle tests PASS | Новая pending-payment semantics зависит от П1/optional proof; полного AT нет |
| AT-14 состав | OrderWorkflow lock/version/idempotency source, PG existing transitions | Новый24h proposal/hold/reminder контракт не замкнут |
| AT-15 stockout | Реальный PG concurrency/stock/rollback PASS | Новый paid-part сценарий не равен старому резерву; нужен новый state contract |
| AT-16 optional proof | AUD-FUNC02: mandatory PAYMENT_PROOF | Правило «можно без файла» ещё не реализовано |
| AT-17 paid-part | supplier split/snapshots и workflow source | Полные paid-part choice/expiry/escalation отсутствуют |
| AT-18 одновременные оплаты | Existing payment/idempotency unit+PG | Все новые P2–P7 concurrent provider paths требуют выбранного live провайдера |
| AT-19 каждый P2–P7 | provider intents/allocations/attempts mapping | Методы/merchant/плательщик/получатель и live admission не приняты |
| AT-20 fee/accrual | bigint10% facts; legacy200bps отдельный контур | Двойное взыскание12% не доказано; полный receipt/refund/cash ledger отсутствует |
| AT-21 due комиссии | Принято5раб.дней после комплекта+отправки | Реальная monthly documents+notification due цепочка не реализована |
| AT-22 месяц | analytics cash/debt=null/historyComplete=false | Ledger/period correction/dispute/credit открыты |
| AT-23 delivery | Docs согласованы с принятыми03.11 payees/fixed quote | Реальные два платежа, final tariff и live carrier не проверены |
| AT-24 shipment timeout | logistics create/paid/transition guards mapping | Live lost-response/booking/reconcile без carrier не доказаны |
| AT-25 получение/code | Supplier не может сам поставить DELIVERED; quantities guards | B2C OTP/live POD/полная приёмка не реализованы/не проверены |
| AT-26 довоз10/8/2 | Discrepancy/return schemas и workflow source | Новый комплексный довоз/расход/повторная проблема не закрыт |
| AT-27 refund | Existing refunds/settlement mapping | Реальный провайдер/partial/late refund/new finance не доказаны |
| AT-28 документы | Version/checksum/immutable confirm; PG и browser registry | Live NCA, mobile return и полная originals/сторон матрица открыты |
| AT-29 Q127 | Invoice/waybill/exception API и operator views | Полный accounting/legal contract не закрыт UI или mock подписью |
| AT-30 supplier-agent | Поиск schema/modules: агентская программа отсутствует | ConnectorAgent — ERP процесс; attribution90days требуется реализовать |
| AT-31 agent settlement | FEE/AGENT требования сопоставлены | Начисление/сверка/выплата/налоги/возвраты программы не реализованы |
| AT-32 уведомления | Notification inbox PG, SLA45/60/120, support toast browser PASS | Live channel receipts/opt-out и все delivery guarantees не доказаны |
| AT-33 operator | 3real operator UI/API/PG + operator-control/exception PG PASS | Полный новый Admin scope остаётся открытым |
| AT-34 CRM link | Organization↔Business/version/checksum/revoke requirements | Отдельный Market CRM bridge отсутствует; CRM read-only boundary не live integration |
| AT-35 финпанель | cash/debt честно неизвестны, projections real tests PASS | Финансовая полнота/расходы/profit/allocations отсутствуют |
| AT-36 mobile | Отдельная branch6d2e8c9 найдена и разобрана read-only | Нет SDK/device/Linux build, debug release config; не разрешено сливать ветку |
| AT-37 RU/KK/a11y | 123pilot+12workspace browser,6custom cases | AUD-UI02/03/04; полные route/locale/screen-reader/native combinations не проверены |
| AT-38 data requests | Privacy/retention documents и security scope mapped | End-to-end lawful export/deletion/retention evidence отсутствует; не трогали рабочие данные |
| AT-39 restore | Tool contracts25 PASS; real drill attempt1 BLOCKED | Dedicated role без CREATEDB; нужны предоставленные admin config, затем DB+objects/keys/queues drill |
| AT-40 release | Build/types/lint/unit/PG/guards/split/composition PASS | Linux/images/Yandex/restore/live/native/security ограничения исключают release PASS |
| AT-41 поздняя банковская корректировка | Provider attempts/legacy settlement source; DG07/09/13 открыты | Новая late-correction цепочка не замкнута; live bank unknown |
| AT-42 credit после позднего возврата | V15А принят, cash projection gap подтверждён | Contract/accounting procedure и credit concurrency ещё не реализованы |

## Документальные исправления

Старые DOC-01–07 относились к V15/V10/V11, П01–П03, RPO/RTO, roadmap и доставке.
Они исправлены без изменения бизнес-выбора или закрытия parent R-ID. Подробности,
инвентарь269 адресов, исторические ограничения и результаты проверки
архива находятся в [документационном отчёте](comprehensive-audit-20261103-docs.md).
История не считается полностью заново сертифицированной. Точные числа архивной
проверки:4/4 новых перемещений и26/26 прежних manifest hashes PASS.
