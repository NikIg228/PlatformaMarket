# ЭЦП: подготовка production, 24.11.2026

Статус всего этапа: **IN PROGRESS, не допущено к реальному подписанию**.
Основание: поручение владельца завершить ЭЦП; Kompra исключена из пилота.
Владелец сообщил, что участников для реального подписания пока нет.
Последовательность и требования остаются в [EDS spec](../../domains/EDS_IMPLEMENTATION_SPEC.md)
и [roadmap](../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md), это evidence, не новый backlog.

## Реализованный срез

- Запрос EDS/EGOV_QR/EXTERNAL без шлюза больше не подменяется mock в development.
  MOCK/SIMPLE явно тестовые и запрещены в production, включая прямой вызов адаптера
  и завершение ранее созданной тестовой сессии. Capabilities учитывает конфигурацию;
  наличие URL не является доказательством работоспособности провайдера.
- Ответ создания сессии со статусом SIGNED не завершает документ. Нужен отдельный
  проверенный callback/CMS. Произвольный ответ шлюза не записывается как evidence.
- HTTP-ошибка/неполный ответ verifier означает недоступность проверки (503),
  а не доказанную недействительность пользовательской подписи.
- Завершение существующей подписи, статус документа, audit и outbox атомарны.
  Проверяются текущие membership/permission, срок сессии, состояние и новая версия.
  Проверенный повтор SIGNED с тем же идентификатором/хешем не создаёт второй эффект.
  Это не реализация полной модели назначения сотрудников или выпуска накладной.

## Проверки текущего кода

| Проверка | Результат и граница |
| --- | --- |
| SDK/Kalkan real test CMS | 11 PASS: действительная подпись, integrity, malformed CMS, expiry, revoked, TSP, policy hash, запрет TEST trust в production, expiry submit, CRL unavailable/malformed. Публичные тестовые ключи SDK, не пользовательские ключи |
| API focused suites | 172 PASS, 1 PostgreSQL test skipped без DB env; этот тест отдельно выполнен ниже |
| PostgreSQL completion | PASS: rollback на outbox failure, concurrency/replay, stale version, revoked permission; только disposable DB |
| Общая PostgreSQL integration | PASS прямым запуском штатного сценария после API build |
| API build | PASS `npm exec --workspace=@marketplace/api -- nest build` с существующим клиентом Prisma |
| Runtime split | PASS: api/worker/all и production entrypoint guards |
| API types | PASS, финальный `npm run typecheck --workspace=@marketplace/api` |
| UI/native signing | NOT_RUN: интерфейс не изменён; участников с пользовательской ЭЦП пока нет |
| Production/restore/mobile | NOT_RUN, готовность не заявляется |

Локальные логи: `.tmp/local-runtime/eds-production-{build,focused-final,transaction,postgres-direct,runtime,types}.log`.
Криптографический отчёт: `.tmp/nca-identity/win32/checks.json`.
Ключи, CMS, SDK/JAR и полные receipts не включены в Git.

Обычный `npm run verify:postgres` остановился на prebuild Prisma generate:
Windows EPERM при замене DLL занятого рабочего API. После успешной сборки Nest
выполнен `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs`.
Генерация Prisma не объявляется PASS; схема в данном срезе не менялась.
Первый crypto запуск использовал устаревший путь SDK, повтор после обнаружения
фактического вложенного каталога PASS. Первый повтор focused suite выявил старый
mock массива транзакций; fixture обновлён под callback, запрет повторного REJECTED
сохранён, финальный прогон PASS. Рабочая БД не изменялась, API не перезапускался.

## Что не закрыто

1. Production trust НУЦ и эксплуатационное обновление сертификатов/CRL/TSP — V53.
2. Полный document verifier/runtime: identity verifier не заменяет проверку
   подписантов и сохранение доказательств по PDF. SIGNATURE_GATEWAY_URL — наш
   интеграционный компонент, не выдаваемый автоматически НУЦ production URL.
3. Выпуск неизменяемой накладной, подписи двух сторон одной версии, полномочия
   и архив/восстановление полного комплекта. WAYBILL_PREVIEW остаётся закрыт.
4. Утверждённые формы и основания подписания — V23/V26/V52; статус формы
   запрошен у владельца. Рабочий PDF не объявляется утверждённой формой.
5. Native NCALayer приёмка с участниками; mobile provider/access и отдельная
   приёмка. Старое desktop evidence не принимается за мобильную интеграцию.
6. Проверенный выпуск и развёртывание; этот срез не включает deploy/реальную подпись.

Официальные сведения проверены 24.11:
[НУЦ для разработчиков](https://pki.gov.kz/en/to-developers/),
[портал SDK](https://sdk.pki.gov.kz/),
[Smart Bridge NITEC-S-5096](https://sb.egov.kz/services/passport/NITEC-S-5096).
Для desktop SDK уже получен; отдельный production API key по найденным материалам
не установлен как требование. Технические вопросы — knca@pki.gov.kz.
Условия mobile доступа требуют подтверждения; запросы от имени владельца не отправлялись.
