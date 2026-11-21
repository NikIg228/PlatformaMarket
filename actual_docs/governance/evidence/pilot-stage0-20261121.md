# PILOT-STAGE0-20261121 — базовая сверка

Дата:21.11.2026. Статус: ANALYSIS_COMPLETE; PRODUCT_NOT_READY.
Основание: записать согласованный план до пилота и выполнить только этап0.
План находится в [единственном roadmap](../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#план-завершения-до-пилота--21112026).

## Scope, риск и проверки

Пользователи результата: владелец и разработчик. Вход: текущие требования,
канонический checkout, незавершённые изменения и evidence. Выход: порядок работ,
фактическая стартовая граница и следующий минимальный шаг. Продуктовые файлы,
процессы, рабочая БД, доступы и внешние сервисы в этой задаче не изменяются.

Прежний план содержал standalone B2C → в текущем roadmap/evidence записано решение
владельца21.11 об отмене B2C → план приведён к покупке клиники с тремя вариантами
оплаты; остальной согласованный функционал сохранён. Не восстановление удалённого.

Skills: market-analyze-product и market-run-verification. Применены targeted source
tracing, разделение реализации/проверки/публикации, сохранение готовых частей.
Gates задачи: сопоставить source/evidence/CI, проверить локальные ссылки, полный
task-only diff и diff hygiene. App/build/DB/browser suites не запускаются ради
записи плана; прошлые результаты ниже не объявляются новыми PASS.

## Git и граница доказательств

- Единственный root: `C:/Users/user/Desktop/PlatformaMarket`, branch `main`.
- Исходный HEAD `8118cf7d8f4bba1f0fe15d8e0ddb0ab9ca83102c`.
- `git fetch origin main` успешен; исходные HEAD и origin/main совпадают, ahead/behind0/0.
- До правок этой задачи:121 изменённый tracked path и602 untracked paths;
  это файлы, не602 задачи. Среди untracked много старых отчётов/изображений.
  Index на старте пуст. Полный локальный inventory: `.tmp/pilot-stage0-20261121/`.
- Последние опубликованные изменения:8118cf7d (clinic home),5176aed5 (order UI).
  Очистка карточек, новые предложения и изменение контекста оплаты в этот HEAD
  не входят. Нет единого опубликованного кандидата текущего dirty runtime.
- Ни один чужой WIP не присвоен этой задаче; ownership/coherent publication
  остаются условиями будущей интеграции. Старый PRIMARY-SESSION не перезаписан.

## Карта незавершённых изменений

| Область | Наблюдение в коде | Граница и следующий тип работы |
| --- | --- | --- |
| Карточки заказа | Обе canonical `apps/web/app/{clinic,supplier}/orders/[id]/page.tsx` возвращают null | Намеренная очистка по владельцу, не случайная регрессия. Полный пользовательский заказ недоступен; новую композицию создавать отдельно, старую не включать автоматически |
| П04 предложения | Локально существуют schemas, Prisma migrations, OrderProposalsService/controller, timers, payment/acceptance helpers, OpenAPI и client methods getOrderProposals/executeOrderProposal. Сервис содержит version/idempotency/transaction guards | Старое evidence17.11 «сервис/API/client/scheduler не реализованы» устарело. Нужны review и проверка уже написанного, затем достижимый UI; поиск вызовов getOrderProposals/executeOrderProposal в web/buyer/supplier/UI не обнаружил consumers |
| Оплата клиники21.11 | Retired personal routes/API/session/context; OrderPaymentService/controller/schema/client и OrderPaymentChoice. Компонент включён в OrderWorkflowWorkspace | Реализация есть, но canonical cards её не монтируют. До browser acceptance нельзя считать выбор оплаты доступным участникам |
| Связь оплаты с П04 | PaymentsService импортирует untracked order-proposal-payment; новая оплата зависит от локальных proposal/schema полей | Нельзя публиковать одну оплату без review зависимостей либо молча добавить весь WIP. Нужен целостный scoped diff с явной границей |
| СДЭК | Отдельные adapters/controller/schema/client, migrations, sandbox UI и deployment files | Учебный/локальный задел сохраняется; не реальная приёмка перевозчика и не основание публиковать вместе с оплатой |
| Прочий UI | Analytics/settings/catalog/conversations/documents, auth и signing имеют изменения; есть несвязанные artifacts | Не очищать и не переписывать. Проверять по отдельным scope; настоящая задача их не принимает |
| Схема/миграции | Среди untracked:три proposal migrations, CDEK migration и20261121190000_clinic_order_card_payment | Evidence отдельно различает disposable и рабочую БД; здесь migration/seed не выполнялись, состояние БД заново не сертифицировано |

## Сверка проверок

### Опубликованный HEAD — свежий readback GitHub

На8118cf7d:

- [CI44913001115](https://github.com/NikIg228/PlatformaMarket/actions/runs/44913001115): FAILURE.
  postgres-integration и container-build API/web SUCCESS; verify упал на
  `npm audit --audit-level=high`.
- [Security44913001028](https://github.com/NikIg228/PlatformaMarket/actions/runs/44913001028): FAILURE.
  CodeQL SUCCESS, dependencies упал на том же audit.
- Лог audit:5 vulnerabilities (2 moderate,3 high). High:цепочка
  `effect → @prisma/config → prisma`, GHSA-7589-6fvf-x4pw;
  moderate:OpenTelemetry HTTP instrumentation, GHSA-3v2p-hm54-8qcq.
  Это результат scanner/CI, не доказанная эксплуатация приложения. Автоматический
  совет `audit fix --force` не выполнялся. Точная remediation требует отдельного
  анализа lockfile/совместимости и проверки, не произвольного downgrade Prisma.
- JSON jobs и полные failed job logs сохранены в `.tmp/pilot-stage0-20261121/`.
  Старый CI44492539074 на5176aed5 имел14 browser failures/109PASS; он не описывает
  причину падения текущего HEAD. Пройденный container build не делает весь CI PASS.

### Локальный dirty код — ранее выполненное, не новый прогон

Прочитана локальная карточка `clinic-payment-context-20261121.md` и соответствующие
логи:dependent97 tests PASS; focused PostgreSQL1 test PASS; runtime split PASS;
core-contract результат есть; API types без ошибок; Next build содержит успешные
compile и TypeScript. Карточка также фиксирует full verify:postgres и другие
focused suites. Это scoped evidence21.11, а не сертификация всего checkout:
точного полного source manifest старого запуска не предъявлено, inputs для
автоматического REUSED_PASS в будущей реализации надо сравнить.

Browser этой работы остаётся BLOCKED:нет новых screenshots/computed styles,
RU/KK/mobile/keyboard acceptance. Новых bank transactions/receipts нет.
В карточке зафиксированы ранее разрешённые working DB migration/dev restart;
этап0 их не повторяет и не расширяет разрешение.

Старый лог build очистки `.tmp/order-ui-20261119/build-web.log` заканчивается на
создании production build. Соседний build-final-results.json относится к прежним
web/buyer runs; его нельзя приписать очистке. Более поздняя сборка21.11 подтверждает
компиляцию текущей на тот момент композиции, но не доступность пустой карточки.

Локальная ошибка e2e-types19.11 про agreedProposalSnapshot остаётся историческим
FAIL:свежего отдельного e2e typecheck не найдено. API types21.11 не заменяет его.
Проверенный раньше webhook lease/reclaim не переоткрывается:готовое исправление
сохраняется; повторный gate только при изменении его inputs.

## Подтверждённый остаток, который нельзя назвать только проверкой

- `commerce.service.ts`:checkout сохраняет ttlMinutes:30 — новый P1 без
  доплатёжного резерва не реализован этим кодом.
- `order-workflow.service.ts`:REPORT_TRANSFER требует input.documentId и
  PAYMENT_PROOF — необязательная квитанция ещё требует изменения контракта/API/UI.
- `payments.service.ts`:ruleSnapshot MARKETPLACE_PERCENT rateBasisPoints:200 —
  согласование с целевой10% комиссией остаётся профильной работой, не косметикой.
- Пустые canonical routes означают отсутствие достижимых этапов заказа независимо
  от unit PASS вложенных компонентов. Восстановление старого UI не разрешено.
- Live bank/carrier/EDS, полный RU/KK desktop/mobile и native release не закрыты
  локальными mock/sandbox результатами.

## Конкретный следующий шаг

Следующий минимальный технический пакет: **разобрать и устранить текущий audit
blocker опубликованной базы** — цепочку effect/Prisma и OpenTelemetry. Сначала
установить версии/зависимости и совместимый минимальный фикс, затем targeted
проверки потребителей и audit/CI; не выполнять blind force-fix, не включать
proposal/payment WIP и не менять продуктовые правила. Этап0 его не начинает.

Следующая продуктовая вертикаль после стабилизации базы: **П04 → UI согласования**.
Review существующих schema/service/controller/timers/client и их зависимости с
оплатой21.11; определить минимальный coherent publication scope; воспроизвести
целевые version/tenant/replay/payment-hold проверки на disposable DB. Затем
реализовать новый экран согласования обеих ролей, а не переписывать backend.
OrderPaymentChoice принимать через новый достижимый экран на этапе оплаты;
полная визуальная приёмка невозможна, пока canonical routes пустые.

Новые бизнес-решения для самой сверки и dependency audit не нужны. Для следующих
продуктовых этапов используются только оставшиеся V-вопросы из roadmap. Конфликт
ownership/совместной публикации локальных изменений разрешается до staging, а не
скрытым объединением чужой работы.

## Завершение этапа0

Код/миграции/данные/процессы не изменялись. Новые runtime tests намеренно NOT_RUN:
scope — документация и анализ, не исправление найденных дефектов и не release.
Сверка не означает готовность к пилоту. Публикация документов и её CI фиксируются
отдельно от статуса продукта в итоговом сообщении.

## Dependency audit — отдельное поручение 21.11.2026

Исходный результат: audit FAIL (3 high, 2 moderate) → повторный локальный audit
подтвердил effect 3.21.0 / HTTP instrumentation 0.221.0 → минимальный delta:
override effect 3.22.1 без смены Prisma 6.19.3; auto-instrumentations-node 0.80.0
и согласованные sdk-node/exporter 0.222.0. Основа: main, 50ac7476.
Scope: зависимости, целевые security regressions и evidence; proposal/payment WIP
не включать и не менять. UI, API-контракты, миграции и рабочая БД вне scope.

Риск: совместимость конфигурации Prisma и запуска/export HTTP-телеметрии.
Применены resolve-dependency-alert, fix-finding (standard), market-run-verification:
проверить все lockfile-копии, ближайшие patched версии, legitimate controls,
отдельно различать локальную проверку грязного дерева и CI опубликованного commit.
Gates: npm audit, dependency security regressions, instrumentation/observability
tests, API types/build (включает Prisma generate), Prisma validate, runtime-split;
затем task-only commit/push и фактический итог CI. Без live provider calls/DB writes.
DoD: audit без уязвимых цепочек, scoped проверки PASS, неизменность WIP,
результат CI прочитан; посторонний CI FAIL фиксировать без изменения заказа/оплаты.

Локальные результаты (Node 24.18.0, npm 12.0.1):

- `npm audit --audit-level=high`: PASS, 0 vulnerabilities вместо 5.
- `npm ls effect @opentelemetry/instrumentation-http @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http --all`:
  PASS; effect 3.22.1, HTTP/SDK/exporter 0.222.0; Prisma/Client остаются 6.19.3.
- `node --test scripts/dependency-security.test.mjs`: PASS 5/5, включая реальные
  Effect invalid/valid inputs и loopback server spans (AWS/Azure credentials скрыты,
  обычный page=2 сохранён). Первый HTTP probe превысил 10s при ещё идущей установке;
  после завершения установки PASS без изменения теста (5.39s).
- `npm exec --workspace=@marketplace/api -- vitest run --dir src src/instrumentation.spec.ts src/platform/observability`:
  PASS 21 tests / 6 files; `node scripts/verify-observability-alerts.mjs`: PASS.
- API `typecheck` и `npm exec --workspace=@marketplace/api -- nest build`: PASS.
  Обычный `npm run build --workspace=@marketplace/api` остановился на prebuild:
  EPERM замены занятой Windows Prisma DLL. Чужие процессы не останавливались.
  Тот же schema/client 6.19.3 успешно сгенерирован в отдельный ignored test output;
  canonical schema/client configuration не менялись. Чистая штатная сборка остаётся CI gate.
- `prisma validate`: PASS с фиктивным DATABASE_URL на порту 1, без подключения.
  Первая попытка без DATABASE_URL дала P1012; это исправление test environment.
- `node scripts/verify-runtime-split.mjs`: PASS после завершения сборки; преждевременный запуск во
  время перезаписи dist дал MODULE_NOT_FOUND и не считается результатом кандидата.
- Сверка SHA-256 всех 723 исходных dirty/untracked файлов: изменений нет.
  Diff ограничен manifests/lockfile, security tests и этой записью; diff hygiene PASS.

Lockfile SHA-256: `f4b8809bcb3a733d9208cfdaf3ca850321565555682e8babc1fa832a02e6247f`.
Обновление auto-instrumentations согласованно обновляет его bundled instrumentation
dependencies; npm также пересобрал transitive layout, удалил устаревшие type-only
зависимости и разрешил grpc через существующий override. Force-fix не применялся.
UI/browser/рабочая БД не проверялись: соответствующее поведение не менялось.
Полные DB/build/E2E проверки опубликованной версии выполняются существующим CI;
до получения результата статус CI остаётся PENDING, а не PASS.

### Итог dependency CI и продолжение: ORDER-E2E-20261121

Dependency commit d882709e опубликован. Security44926804127 SUCCESS;
CI44926804110: audit/security regressions/types/lint/tests/build/observability/
runtime/PostgreSQL/container jobs PASS, canonical browser FAIL:14/109PASS.
Список14 совпадает с прежним CI44492539074. Последующие full-access/go_live/promotion
шаги пропущены из-за падения браузерного этапа, а не отключены исправлением.

Новое поручение владельца: разобрать14 E2E, исправить устаревшие ожидания либо
реальные дефекты без ослабления гарантий/потери WIP, получить зелёный CI.
Предыдущий результат14FAIL → сравнение логов и опубликованных компонентов →
проверить и завершить уже существующие изменения двух specs, не переписывать UI.

| Сценарии | Число | Подтверждённое расхождение ожидания с HEAD |
| --- | ---: | --- |
| Контакты поставщика1440/390 | 2 | Контакты внутри details; сначала раскрыть |
| A15 PDF boundary/retry | 1 | Форма загрузки внутри details; сокращена подпись file input |
| CORE02 supplier payment1440/390 | 2 | Подпись теперь «Подтвердить получение денег» |
| CORE02 buyer receipt1440/390 | 2 | Удалён служебный текст о графике поставщика; сокращена подпись file input |
| CORE02 mobile policy | 1 | Настройки внутри details |
| CORE03 refund1440/390 | 2 | Действие теперь «Повторить заказ» |
| CORE03 return agreement | 1 | Подпись теперь «Согласовать условия и сумму» |
| Supplier confirmation | 1 | Загрузка счёта внутри details |
| Order terminal detail1440/390 | 2 | Комментарий внутри «Проблема с переводом» |

Риск: принять несоответствие локаторов за успешный бизнес-сценарий.
Сохранить суммы выше2^53, explicit consent, payloads, retry identity, PDF byte
boundaries, удержание ввода, desktop/mobile и отсутствие overflow. Добавить
положительную проверку доступной формы; раскрытие контактов проверить клавиатурой.
Применены market-review-frontend и market-run-verification; визуальный редизайн
не входит в scope. Продуктовые изменения допускаются только при воспроизведённом баге.

Canonical local order routes намеренно возвращают null по прежнему поручению.
Их и новую неопубликованную оплату/proposals не восстанавливать/публиковать ради CI.
Локальная browser-проверка опубликованного UI невозможна на этом dirty checkout;
копии/worktrees запрещены, рабочие API4012/web3000 и БД сохраняются.
Проверки до публикации test-only candidate: scoped lint, E2E types/discovery,
полный review диффа и сохранность остального WIP. Браузерное исполнение кандидата:
существующий CI на чистом checkout; требуемый результат всех jobs SUCCESS.
До зелёного CI считать исправление проверяемым кандидатом, не завершённой приёмкой.

Предпубликационные проверки кандидата: scoped TypeScript для двух specs с исходным
strict tsconfig PASS; scoped ESLint PASS; canonical Playwright discovery14/14 PASS.
Все бизнес-assertions сохранены. Раскрытие контактов теперь дополнительно проверяет
closed/open и клавиатуру Enter; проверка формы квитанции положительная (visible/editable).
Полный локальный E2E typecheck FAIL в неизменённом workspace-list-volume.spec.ts:134:
dirty Prisma добавил agreedProposalSnapshot: JsonValue, копируемый в create без
преобразования null. Это отдельный WIP/schema-fixture gap, не ошибка двух specs;
не маскировать casts/ts-ignore, не включать в публикацию этой задачи.
Полный typecheck публикуемого состояния и все14 browser cases остаются CI gates.

Кандидат0f0de4b1: CI44930147410 подтвердил полный typecheck/lint/tests/build,
PostgreSQL, оба контейнера; Security44930147412 SUCCESS. Browser119PASS/4FAIL:
10 из14 исправленных сценариев прошли; ещё4 дошли до следующих устаревших ожиданий.
Refund1440/390: ссылка в HEAD называется «Перейти в корзину», href /clinic/cart
сохранён. Terminal1440/390: orderOverview намеренно выбирает history для CANCELLED;
тест искал label оплаты в скрытой вкладке. CI screenshots refund390 и terminal1440
из ci-diagnostics14718051805 скачаны и визуально проверены: ссылка присутствует,
выбрана «История», статус отмены виден. Product regression этими падениями не доказан.
Минимальный delta2: точная подпись ссылки + visible/href; history selected → обычный
клик «Оплата» → прежний payment label + отсутствие подтверждения денег/выставления
счёта. Никаких forced clicks, скрытых DOM-проверок вместо visible или отмены assertions.
Результат следующего полного CI остаётся обязательным; первый FAIL сохранён.
