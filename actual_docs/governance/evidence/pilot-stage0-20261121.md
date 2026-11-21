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
