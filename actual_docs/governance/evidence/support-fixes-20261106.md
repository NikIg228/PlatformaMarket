# Поддержка: исправления 8 замечаний — 06.11.2026

Поручение: исправить все восемь замечаний [аудита](../../../anti-slop/audit-004-2026-11-06.md) и провести браузерную приёмку. Результат: изменения реализованы и проверены локально; публикация заблокирована пересечением с прежним WIP. Общая production/release-приёмка не заявляется.

Каноническая папка: `C:/Users/user/Desktop/dentmarket-kz-main`, `main`, исходный и текущий HEAD `5161af7f83f909ad90901de403daa3f7fde0e928`. Снимки исходных затронутых файлов и план: `.tmp/support-fixes-20261106/before/`, `plan.md`. Чужой index, исходники и рабочие данные сохранены.

## Результат по замечаниям

| № | Исправление | Подтверждение |
|---|---|---|
| 1 | Колонки карточки ограничены `minmax(0, 1fr)`, тема сокращается, время остаётся видимым. | Длинная тема в RU/KK и трёх viewport; живой Chrome: clientWidth/scrollWidth карточки 303/303 px. |
| 2 | Композиция шапки привязана к DOM-контракту оболочки, без русского aria-label. | Supplier 390×844 KK, clinic 844×390 KK, отсутствие горизонтального overflow. |
| 3 | Flex-цепочка root → main → PermissionFields → поддержка передаёт фактическую оставшуюся высоту. | Нет внешнего скролла; короткая история заполняет свободную область, длинная сохраняет независимый scroll. На низком экране редактор доступен прокруткой панели. |
| 4 | RU/KK для системных строк поддержки, форм, поиска, файлов, статусов, авторов, дат. | Проверены подписи, search/clear, validation и focus. Текст пользователей не переводится. |
| 5 | Ошибка постоянно видна внутри панели; 400/403/404/422 останавливают auto-refresh, показывают возврат к списку; временный сбой допускает retry. | Invalid link на KK после 60 секунд виртуального времени: новых запросов нет, объяснение остаётся. Recovery временного сбоя PASS. |
| 6 | Отдельное `lastPublicMessage` в Zod/API/client, preview только последнего публичного ответа или вложения. | Unit + реальная PostgreSQL-проверка private note/tenant. В живом кабинете после рестарта API превью соответствует последнему ответу. |
| 7 | Возврат из detail восстанавливает фокус карточки; открытие формы фокусирует заголовок, ошибки — поле. | Mobile KK и desktop RU; возврат формы на заголовок списка. |
| 8 | Отдельный `aria-live=polite`, atomic status о новых сообщениях; фокус не переносится. | Реальный 15-секундный polling: история не прыгает, появляется кнопка перехода, live-status содержит счётчик. |

Изменения API и общих UI-параметров описаны в [контракте экрана](../../applications/support-workspace.md). Схема Prisma/миграции не изменены. Превью формируется ограниченным запросом только для авторизованной страницы списка; внутренние заметки не раскрываются, включая preview операторской очереди.

## Проверки

Все логи ниже находятся в `.tmp/support-fixes-20261106/`.

- `npm exec --workspace=@marketplace/api -- vitest run src/modules/support/support.service.spec.ts`: **12 PASS**, `backend-unit.log`.
- `npm exec --workspace=@marketplace/api -- vitest run src/modules/support/support-attachments.service.spec.ts src/modules/support/support-notifications.spec.ts`: **9 PASS**, `backend-dependent.log`.
- `npm exec --workspace=@marketplace/schemas -- vitest run src/support-workflow.test.ts src/support-files.test.ts`: **5 PASS**, `schemas.log`.
- `npm exec --workspace=@marketplace/api-client -- vitest run src/support-workflow.test.ts`: **2 PASS**, `client-tests.log`.
- `npm run db:test -- exec --workspace=@marketplace/api -- vitest run src/modules/support/support-workflow.postgres.spec.ts`: **1 PostgreSQL scenario PASS**, `backend-postgres.log`, disposable `127.0.0.1:5432/dentmarket_audit_20260914`. Этот сценарий также сохраняет проверки повторных команд, файлов, rollback и изоляции. Рабочая БД не использовалась для тестовых записей.
- `npm exec --workspace=@marketplace/e2e -- playwright test --config=playwright.support.config.ts` и точечные повторные запуски: **22 уникальных сценария с PASS**. Источники: `browser1.log`, `browser2.log`, `browser3.log`, `browser-final.log`, `browser-low-height.log`. Все mutations перехватываются fixture API. Реальный dev использован отдельно только для чтения/навигации.
- `npm run typecheck --workspace=@marketplace/api`, `--workspace=@marketplace/web`, `--workspace=@marketplace/ui`, `--workspace=@marketplace/e2e`: PASS. Web build дополнительно проверяет финальные TS-входы. Логи `api-types.log`, `web-types2.log`, `ui-types-final.log`, `e2e-types-final.log`.
- `npm run build --workspace=@marketplace/schemas`: PASS. `npm run build --workspace=@marketplace/web` в `go_live`: PASS, финальный `web-build-final.log`. Первая успешная сборка была до добавления переводимых search/clear в shared DmSearch; повтор обоснован изменением этих входов.
- `npm run build --workspace=@marketplace/api` выполнен и успешно завершён штатным `npm run dev` перед запуском обновлённого API: `dev-restart.log`. Schema validation без изменений схемы обеспечена prebuild Prisma generation; migration/upgrade не требуются.
- Scoped ESLint всех затронутых TS/TSX: PASS, точный набор файлов — `lint-final.log`; добавленный low-height тест также прошёл `e2e-lint-final.log`.
- `npm run verify:ui-contract`: **5 tests + UI contract PASS**, 473 CSS/TSX, `ui-contract.log`.
- `git diff --check`: PASS. Полные проектные/release suites не запускались: область — поддержка и совместимые параметры её shared controls.

### Сохранённые неуспешные попытки

Первый browser run: 11 PASS / 6 FAIL. Два сбоя — устаревшие fixture endpoints контекста клиники; один — неоднозначный locator после появления одинакового текста в preview и истории. Остальные выявили неполную передачу высоты через PermissionFields. Исправлены fixtures/locators и flex-композиция, assertions не ослаблялись. Второй run: 9 PASS / 1 FAIL (long-history), запущен до последней правки fieldset; третий целевой run long-history: PASS. Также тест ожидает завершения исходного автоскролла до ручного перемещения вверх. Четвёртой попытки того же блокера не было. Два дополнительных запуска относятся к новым search-copy входам и новой проверке низкого экрана.

Первый typecheck обнаружил устаревший schemas/dist и ошибку области видимости переводчика в support-files; после rebuild схем и исправления — PASS. Эти неудачные логи сохранены и не переименованы в успешные.

## Живой браузер и визуальная приёмка

Chrome через Computer Use: открыта текущая сессия поставщика, проверены desktop RU и 390×844 KK, длинная тема, отсутствие переполнения, возврат фокуса и последнее сообщение после обновления API. До исправления карточка 303 px содержала колонку около 520 px; после — 303/303 px. На мобильном document scrollWidth/scrollHeight = 390/844, как viewport. Системные строки и дата соответствуют locale. Отправка/загрузка/удаление рабочих данных не выполнялись. Исходные RU URL и размер браузера восстановлены.

Автоматические screenshots на синтетических данных:

- [Desktop RU, длинная тема](../../../apps/e2e/output/playwright/support/audit-supplier-1440-ru.png)
- [Mobile KK](../../../apps/e2e/output/playwright/support/audit-supplier-390-kk.png)
- [Clinic KK, низкий экран](../../../apps/e2e/output/playwright/support/audit-clinic-844-kk.png)
- [Доступный редактор на низком экране](../../../apps/e2e/output/playwright/support/audit-clinic-low-height-reply.png)

Anti Slop AFTER follow-up: C-4/R-03 geometry и локализация поддержки PASS; R-26 recovery PASS в проверенных сценариях; R-32 focus/live DOM PASS; общие tokens/controls сохранены. Цвета не менялись, прежние измерения контраста остаются применимыми. Реальный screen reader и виртуальная клавиатура физического телефона не тестировались. Внешняя общая панель контекста покупателя `BuyerContextBar` на clinic по-прежнему содержит русский текст при KK; это существующий shared-shell участок вне восьми исправлений поддержки, в данном scope не переделан.

## Dev и публикация

Dev восстановлен штатным `npm run dev`: API 4012 и web 3000, профиль go_live, каноническая папка. На проверке API PID 17204, web PID 7216. Они оставлены работающими для владельца. Deployment не выполнялся.

Commit/push **не выполнены**. Проверка отдельного собственного patch в временном индексе на HEAD не прошла для `support.tsx`, `support-ticket.tsx`, `packages/ui/src/support-files.tsx`: собственные hunks используют ранее незакоммиченные изменения loading-state. Доказательство — `publication-check.json`. Основной index с чужими stock-quantities изменениями не изменён. После fetch origin/main checkout всё ещё ahead 7 (прежние commits), их публикация не входит автоматически в это поручение. CI для этой задачи NOT_RUN, поскольку нового commit/push нет.

Следующий шаг публикации: принять/опубликовать прежний loading-state change set и проверить принадлежность/готовность семи исходящих commits; затем отделить и проверить support patch относительно принятой базы. Это ограничение доставки, а не незавершённая локальная браузерная проверка. R7.1 целиком не закрывается.

## Follow-up по скриншоту владельца: ширина без выбранного обращения

После первоначальной приёмки владелец показал сжатую страницу при отсутствии
выбранного ticketId. Предыдущие проверки overflow не доказывали заполнение всей
доступной ширины: открытая длинная переписка маскировала этот дефект.

Причина: после включения column-flex у оболочки сохранился `margin-right: auto`
от общего `.main`. Он поглощал свободную ширину. В живом Chrome при viewport1536
main занимал x200…955.91 (755.91px), правый auto-margin — 580.09px.
В scoped support CSS задан `margin-right: 0`; sidebar/mobile offsets сохранены.
После HMR тот же экран: main x200…1536, ширина1336px, margin-right0.

Добавлены три browser regression-сценария (1536/1024/390 × список без выбора,
переписка, новая форма, возврат, форма первого обращения). Они проверяют не только
отсутствие overflow, но и совпадение правого края main с viewport и корректный левый
отступ. **3 PASS** (`width-browser.log`), первая попытка. Изменения рабочих данных
не выполнялись. Живой Chrome подтвердил результат без изменения размера окна.

E2E types и scoped lint PASS (`width-e2e-types.log`, `width-lint.log`), diff hygiene PASS.
Финальная isolated go_live web build + TypeScript: PASS, exit0 (`width-build.log`). Использован штатный build с отдельным NEXT_ADAPTER_PATH/distDir, без остановки dev; generated next-env восстановлен.
Dev и API оставлены работающими; backend inputs не менялись, повтор DB/unit suites
для одной CSS-правки не требуется. Прежний блокер публикации сохраняется.
[Скриншот списка после исправления](../../../apps/e2e/output/playwright/support/width-list-1536.png).
