# A07 — восстановление потерянного ответа workflow

Владелец: «Ничего, отлично, приступай» после предложения A07 с сохранением
A04 BROWSER_BLOCKED. Канонический main@5161af7, ahead7; ранее изменённые
файлы других циклов сохранены. Новых агентов/следующих циклов нет.

## План до реализации

FE-RECOVERY-001: после commit и потери ответа polling скрывает исходное
действие, но tracker блокирует следующую команду. Нужен отдельный доступный
replay точной сохранённой команды, независимо от текущего статуса/ввода формы.
GET не подтверждает исход операции. Существующий сервер проверяет tenant,
permissions и hash и возвращает прежний result до проверки expectedVersion.
Контракт/API/backend не меняются. FE-FORM-001 уже обработан в A02.

Риск: повторный эффект, новая версия/ключ вместо прежних, неверный success,
дубли при двойном клике. Focused tracker/feedback regression: polling,
повторный timeout/5xx, окончательный rejection, success/следующее действие.
Dependent server workflow tests проверяют существующую семантику replay.
Completion: UI и buyer/supplier/unified types, unified build, lint/UI contract,
diff hygiene. Browser: lost committed response → polling → replay → next action;
1440RU/390KK, клавиатура, screenshot/computed. Прежний launch-blocker A04
не обходить и не сбрасывать счётчик; при сохранённом ограничении browser BLOCKED.
Без working DB, live provider, deploy и публикации прежних outgoing commits.

UI паспорт: существующие DmFeedback и DmButton в OrderWorkflowWorkspace;
иерархия/цвета/44px control/radius8/font14 и spacing из component-contract.json,
semantic-light.json и shared adapters; без CSS/токенов/новых assets.
Выделить feedback в feature-компонент, не увеличивать большой route/workspace.
Consumers: unified workspaces/order-detail и legacy buyer/supplier orders/[id].
Применяются Development Toolkit frontend/execution/verification и ранее
выбранный antislop DURING. Полная приёмка требует browser evidence.

## Реализация и результаты

Tracker отдаёт сохранённую команду; отдельный OrderWorkflowFeedback предлагает
восстановление независимо от текущего status и видимости исходной кнопки.
Replay сохраняет payload/version/key. Working ref не допускает двойного
отправления, canAct проверяется снова; success очищает pending, позволяет
следующее действие и сохраняет прежний переход к корзине для REORDER.
Повторная неопределённая ошибка сохраняет recovery; definitive4xx следует
существующему rejection-контракту. GET не очищает pending. Новых CSS/зависимостей,
backend/schema изменений нет. Большой workspace уменьшен выделением feedback.

- `npm exec --workspace=@marketplace/ui -- vitest run src/order-workflow-command.test.ts`:
  до реализации 5 ожидаемых FAIL/5 PASS на отсутствующий retained accessor.
- `npm exec --workspace=@marketplace/ui -- vitest run src/order-workflow-command.test.ts src/order-workflow-recovery.test.tsx`:
  attempt1 tracker10 PASS, suite import FAIL (Node ESM/Tabster export).
  Изолированы presentation children/Fluent в handler harness; attempt2 12 PASS.
  После добавления проверки самой recovery-кнопки attempt3 13 PASS.
  Реальные workspace handlers с mock hooks/API: committed-response loss,
  polling удаляет прежнюю кнопку, точный replay, двойной клик, следующий CANCEL,
  повторный503, permission loss, definitive409; feedback выбирает POST replay,
  не GET, disabled при busy/denial. Это не DOM/browser-проверка.
- `npm exec --workspace=@marketplace/api -- vitest run src/modules/commerce/order-workflow.spec.ts`:
  10 PASS1, существующий scoped/hash-bound replay до проверки новой версии,
  конфликт изменённого запроса, роль/tenant. Backend/БД не изменены.
- `npm run typecheck --workspace=@marketplace/ui --workspace=@marketplace/buyer-web --workspace=@marketplace/supplier-web --workspace=@marketplace/web`:
  четыре PASS1.
- `npm run build --workspace=@marketplace/web`: PASS1. Generated next-env восстановлен
  к исходному dev import; исходный файл до build был чистым.
- `npm run lint`: PASS1, в том числе UI-contract 5tests/476files.
- `git -c core.safecrlf=false diff --check`: PASS.

Логи `.tmp/workflow-recovery-{before,ui-1,ui-2,ui-3,api-1,types-1,build-1,lint-1}.log`.
Source/React Best Practices review: per-order/org keyed state, cleanup/alive guard,
one in-flight write, no new effect/listener/dependency, shared semantic controls.
FE-FORM-001 не переписан: A02 evidence сохраняется для неизменённых входов.

## Незавершённая приёмка

A07 BROWSER_BLOCKED, не LOCAL_PASS. Сохраняется общий frontend launch-blocker
A04 (три `blocked by policy` до CreateProcess); нового разрешённого изменения
условий/устранения причины нет. Повторный запуск и обход другим инструментом
не выполнялись. Screenshot/computed styles/keyboard/1440RU/390KK NOT_RUN.
Antislop Delivery Gate не закрыт. После устранения launch restriction выполнить
указанный browser scenario с изолированным API fixture, без working DB.

В этой фазе нет dev/API процессов, внешних вызовов, новых агентов, commit/push/CI
или deploy. Предыдущий staged/unstaged WIP сохранён; main@5161af7 ahead7.
A08 и следующие циклы не начинались. Полная реализация A07 подготовлена локально;
общая приёмка остаётся открытой только по указанному browser gate.
