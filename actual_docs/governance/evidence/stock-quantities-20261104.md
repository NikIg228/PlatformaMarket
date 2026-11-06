# Цикл 2 — остатки и количества, 04.11.2026

Статус: LOCAL_PASS; публикация заблокирована прежней исходящей историей аудита.
Владелец явно разрешил следующий цикл и указал название
«Остатки и количества». База main@af714969; незакоммиченный цикл1 search/compliance,
его regression scripts и документация сохраняются. Другие WIP не публиковать.

Граница: B036 (потеря резерва при manual override), FE-QUANTITY-001 (минимум + шаг),
FE-NUMBER-001 (native step quantity), FE-FORM-001 (ошибки количества в расхождении).
Новая ERP/UOM-модель, срок резерва, платежи и остальные группы аудита не входят.
Без миграций, рабочих данных, внешних провайдеров и новых агентов.

План проверки до реализации: высокий риск stock/concurrency — целевой regression
сначала, затем транзакционное чтение актуального резерва и проверка инварианта,
focused API tests перед UI. Реальный disposable PostgreSQL: конкурентное обновление,
сохранение резерва, invalid input, tenant/role denial, rollback. Затем общий PG gate,
API types/build, core-contract при затронутом purchase contract.
UI: shared controls и действующий schema contract; unit + reachable browser flow,
валидное/ошибочное/исправленное количество, desktop/mobile/keyboard; affected types
и builds, UI-policy/lint/diff hygiene. Старые успешные проверки не сертификат изменений.
Dev оставлен выключенным по предыдущему поручению; запускать только принадлежащие
этому циклу тестовые процессы. Publication отдельно от LOCAL_PASS: исходящая история
содержит local-only аудит, не разрешённый к публикации первым циклом.

Backend: исходный regression 4FAIL/1PASS (устаревший резерв, пропущенный инвариант,
дробный остаток, внешний read вместо scoped tx read). После переноса чтения под
row lock и Decimal расчёта inventory suite: attempt1 8FAIL/48PASS (старые mocks
не имели tx reads); attempt2 1FAIL/59PASS (ожидание number вместо Decimal);
attempt3 60PASS. Сигнатуры/права и PRICE сценарии сохранены.
API build1 PASS, включая Prisma generate; PG focused1 PASS:
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --stock-quantities-only`.
Два реальных соединения, tenant denial HTTP/service, invalid rollback и outbox
rollback, fractional HTTP write. Логи `.tmp/stock-quantities-20261104/`.

UI паспорт: владелец выбрал antislop DURING в этом чате. Действующие формы закупки
для клиники/оператора; ENERGY1/RHYTHM1/MOTION1 по DESIGN_SYSTEM, без нового дизайна.
Сохраняются Manrope14/line1.5, controls44/radius8, dialog16, semantic light palette,
shared DmInput/DmField/DmButton. Аналог: текущая reason-validation в
packages/ui/src/order-discrepancy-form.tsx и controls.tsx; ошибки количества
привязаны к тому же Field. Текущие controls, два JSON и исходные screenshots аудита
сверены; новые CSS/assets/layout не нужны. Цвет danger обозначает конкретную ошибку,
текст объясняет исправление; focal action остаётся сохранением/добавлением.

## Результат и проверка

B036: balance читается после tenant-scoped FOR UPDATE внутри Serializable;
проверка и вычисление доступного остатка используют текущие reserved/safetyStock
и Prisma.Decimal. Формат команды и прежняя семантика явно переданных полей
сохранены. Это исправление устаревшего чтения, не реализация новой ERP authority.
FE-QUANTITY-001: начальное количество равно минимуму, шаг считается от минимума,
как в commerce-rules; 3/2 допускает3,5,7 и отклоняет4. Лимит100 сохранён.
FE-NUMBER-001: четыре операторских quantity controls получили step0.000001.
FE-FORM-001: оба поля количества используют issues общей схемы; ошибка видна
возле соответствующего поля, после submit оно получает фокус, черновик сохраняется.
API/schema/migration контракты не изменены; новые интерфейсы не требуются.

| Проверка | Результат |
| --- | --- |
| `npm run test --workspace=@marketplace/api -- src/modules/inventory` | 60PASS, попытки описаны выше |
| API commerce-rules.spec.ts / personal-cart.service.spec.ts через тот же test script | 7+13PASS; первоначальная команда ошибочно включала несуществующий personal-cart.spec.ts, поэтому её7PASS относятся только к commerce-rules |
| `npm run test --workspace=@marketplace/buyer-web -- app/features/catalog/supplier-quantity.test.ts` | исходно2FAIL/2PASS, после исправления4PASS |
| `npm run build --workspace=@marketplace/api` | PASS1 с Prisma generate |
| `npm run build --workspace=@marketplace/{web,buyer-web,admin-web,supplier-web}` отдельно | Все PASS1, действующие bundle budgets не менялись |
| `npm run typecheck --workspace=@marketplace/{api,ui,buyer-web,admin-web,supplier-web,web,e2e}` отдельно | Все PASS; e2e2 после правки локатора, остальные1 |
| `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` | PASS3; попытки1/2 FAIL из-за коллизий новых fixture indices71/72 и90 с существующими сценариями. Итоговые7/8 не пересекаются; продукт ради fixture не менялся |
| `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only` | PASS1,71 core operations/209 success schemas/301components |
| `npm exec --workspace=@marketplace/e2e -- playwright test --config playwright.stock-quantities.config.ts` | 6PASS/2FAIL1: ошибочный относительный has-локатор операторской формы. Исправлен только test |
| та же browser-команда `--grep 'operator integer and fractional' --output ../../output/playwright/stock-quantities-20261104-attempt2` | 2PASS2, суммарно8 уникальных сценариев PASS |
| changed-file ESLint `--max-warnings=0`, `npm run verify:ui-contract`, `git diff --check` | PASS |

Browser: production web на3300, read-only SSR fixture4129; все API подменены,
рабочих записей нет. Клиника/личная корзина1440RU/390сKK URL:3→5, +/-/keyboard,
ошибка4/100, лимит99, success/409/retry без потери5. Оператор1440/390: tier20/30.5,
contract1, расчет0.25/20, отрицательные native0/7decimal cases. Расхождение1440/390:
damaged-1, actual01/пусто/7decimal/13digits, field description/focus, correction
1.5/0.25, сохранение и Escape. Русский текст существующей формы не объявляется
полной KK-локализацией. Backend guards подтверждены отдельно HTTP/PG.
Скриншоты inspected: output/playwright/stock-quantities-20261104 и вариант-attempt2.
Computed input Manrope14/44px/radius8 и buttons44 подтверждены. Длинный screenshot
операторского компонента содержит fixed shell в середине захвата; это ограничение
element screenshot, не доказательство нового layout-дефекта. Overflow assertions PASS.

## Antislop / React review (только изменённые поверхности)

- R02/15/16 PASS: новый текст объясняет минимум/шаг и конкретную ошибку без рекламных обещаний.
- R03/32/35 PASS: указанные8 browser scenarios, keyboard/focus/Escape и390px, screenshots/computed styles; реальные мобильные устройства не проверялись.
- R17/18/23/24/28/36/38 PASS: новых assets, навигации, FAQ, статистики и вымышленных product claims нет; fixtures явно тестовые.
- R25/27/39 PASS в границе изменений: shared Field error/text/aria-describedby, сохранение ввода и исправление проверены; палитра/controls не переопределены. Нет общей сертификации доступности.
- R26 PASS: изменённые действия реально отправили ожидаемые mock-команды, ошибки не отправляют; API correctness отдельно PG.
- R33/34/37/40 PASS: прямые изменения исходников, существующая light design system, без новых themes/media/scripts; performance field metrics не заявляются.
- Purpose/R31 PASS: параметры дизайн-системы сохранены ради согласованности; новых декоративных решений нет.
- Liveliness/Quality/C1–C5 PASS в scope: ENERGY1/RHYTHM1/MOTION1, существующий focal action, разделение полей, semantic accent, без редизайна.
- React review PASS: schema-derived errors без дублирования состояния/regex, DOM form захвачен синхронно до callback, hooks order и shared adapters сохранены; новых dependencies/fetch effects нет.

Рабочая БД, deploy и миграции не изменялись. Собственные тестовые процессы
завершены; порты3000/3300/4012/4129 свободны. Dev остаётся выключенным.
Scope cycle1 и чужой WIP сохранены. Push/CI этого цикла NOT_RUN: origin/main
отстаёт на прежние четыре local-only commits, включая аудит; это не разрешение
публиковать их. Следующий цикл не начат.
