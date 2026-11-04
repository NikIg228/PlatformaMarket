# Цикл 3 — AI: конфиденциальность и повторные действия

Статус: LOCAL_PASS. Поручение владельца04.11: «Приступай к AI:
конфиденциальность и повторные действия». База main@af714969; исходные staged
и unstaged изменения циклов1/2, документации и apps/web сохранены.

## Граница и план проверки

B016: исходный пользовательский секрет уходил провайдеру, хотя сообщение
сохранялось с маской. B017: два подтверждения читали AWAITING_CONFIRMATION
и безусловно переводили одну операцию в RUNNING, создавая два обращения.
Исходные воспроизведения: full-audit-20261104/backend/ai-raw-prompt-probe-1.json
и ai-concurrent-confirm-probe-1.json. Их исторические FAIL не переписаны.

До реализации выбран план: очистка до сохранения/планирования и на границе
провайдера; атомарный захват подтверждения; focused tests после изменения;
при завершении API types/build, реальные PG concurrency/rollback/permissions,
общий PostgreSQL gate и runtime composition. Риски: раскрытие текста, повторная
запись, потеря штатных текстов/чисел, нарушение scope actor/organization.
Миграции, включение AI, новый UI, provider calls и рабочие данные вне scope.

## Изменение

- AiAssistantService использует очищенный текст для сообщения, tool plan и
  вопроса модели. Старое pending input очищается перед исполнением. Результат
  инструмента, сохранённый ответ и текст ошибки очищаются в том же пути.
- OpenAiResponsesService повторно очищает весь структурированный payload до
  fetch. AiSafetyService обходит вложенные объекты/массивы, закрывает именованные
  credential fields и формы assignment/quoted JSON, сохраняет обычные значения;
  BigInt передаётся строкой без потери точности. Date/Prisma JSON-представления
  сохраняются. Provider authorization header остаётся штатным и не логируется.
- Подтверждение использует updateMany с id/conversation/organization/user,
  AWAITING_CONFIRMATION и requiresConfirmation. Только count=1 разрешает tool;
  конкурентный проигравший получает409. Последующий повтор завершённого либо
  failed действия получает прежний404 без повторного tool call.

Формы request/response и полномочия не изменены. Новые интерфейсы не нужны
для исправления этих серверных границ: существующий buyer-services-panel
передаёт confirmedToolExecutionId:null; полноценный UI подтверждения помощника
этим циклом не вводится. По функциональной карте AI-помощник вне плана пилота;
задача исправляет существующий код и не меняет entitlement/profile.

## Проверки

| Команда | Результат |
| --- | --- |
| `npm run test --workspace=@marketplace/api -- src/modules/ai/ai-assistant.service.spec.ts src/modules/ai/ai-safety.service.spec.ts src/modules/ai/ai-tools.service.spec.ts src/modules/ai/openai-responses.service.spec.ts` | PASS1,18 tests |
| `npm run test --workspace=@marketplace/api -- src/modules/ai src/modules/access-control/platform-authority.policy.spec.ts` | PASS2,36 tests; расширение на alternate secret forms и зависимую policy |
| `npm run typecheck --workspace=@marketplace/api` | PASS1 и PASS2 после добавления тестов |
| `npm run build --workspace=@marketplace/api` | PASS1, включая Prisma generate; продукт после сборки не менялся |
| `npm run db:test -- exec -- node scripts/verify-ai-actions.mjs` | PASS1; PASS2 после добавления rollback case |
| `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` | PASS1; после выполненной API build, без лишней пересборки |
| `node scripts/verify-runtime-split.mjs` | PASS1, после той же build: api/worker/all и entrypoint/production guards |
| changed-file ESLint `--max-warnings=0` | PASS; script после добавления rollback проверен отдельно |
| `git diff --check` | PASS |

Новый PG regression script запускается отдельной точной командой выше; shared
dispatcher с чужими незакоммиченными изменениями не менялся. Его isolated target
проверяется до записей: loopback/dentmarket_audit_20260914/public и SQL identity.
Два Prisma connections принудительно читают одну pending строку до CAS:
один success/один409, одна ticket/message/audit. Проверены replay404, чужие
actor/organization404, реальный permission denial403 и сохранение pending,
штатный confirm после возврата права, отсутствие синтетического секрета в ticket.
Сбой supportMessage откатывает ticket/audit; execution становится FAILED,
повтор не создаёт обращение. Фикстуры удаляются в finally; рабочая БД не менялась.

Unit/provider tests используют только синтетические значения и fetch stub:
raw caller, вложенные поля, quoted JSON, массивы, обычный вопрос, BigInt,
legacy pending, отсутствие провайдера, отказ прав, конкурентность, completion
failure после успешного tool. Реальный внешний запрос не выполнялся.

## Review и ограничения

Применены fix-finding и прочитанный checklist Agency Code Reviewer:
source-to-sink, прямые callers, tenant/role, альтернативные формы, конкуренция,
совместимость и сбои. Две самостоятельные проверки границ — до исправления
и после; агенты не запускались согласно правилам владельца. Проверено, что
обе ветки CAS не допускают повторного execute, и что provider boundary защищена
даже при прямом raw caller. Новый DI dependency зарегистрирован существующим
AiModule; API startup и runtime split прошли.

Редакция распознаёт перечисленные credential patterns/keys; это не обещание
распознать любой произвольный секрет, медицинские или персональные данные.
Исторические записи в БД не переписывались. После успешного tool и сбоя записи
итога нет повторного действия; автоматическое восстановление ответа и полноценный
replay-result контракт не добавлялись. Новый запрос на новое действие остаётся
отдельным действием, защита привязана к одному execution ID.

Frontend/browser suites не требуются для неизменённого UI; живые провайдеры и
production не сертифицированы. Dev остаётся выключенным, deploy не выполнялся.
Публикация/CI заблокированы четырьмя прежними local-only коммитами в outgoing
range: новое поручение не разрешает публиковать чужую историю. Следующий цикл
не начат.
