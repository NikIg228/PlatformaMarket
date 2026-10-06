> ARCHIVE · снимок до пересборки06.10.2026. Старые статусы, команды и следующие шаги не являются текущим поручением. Требования: [описание проекта](../../../../../PROJECT_OVERVIEW.md); остаток: [roadmap](../../../../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md). Приёмка ограничена указанными в исходном тексте версиями.

# CORE-08 — контракты, ограничения ресурсов и качество кода

Статус CLOSED / CI_PASS02.10.2026,15:53+05. Один primary writer:
01a0f302-2d38-75d1-b79c-141e7428b533. Основание — поручение владельца02.10
последовательно завершить CORE05–09 с проверками, publication/CI и итоговым аудитом.
CORE07 CLOSED:3f2002b + corrective7cec2fa; CI36990679071/Security36990679215 SUCCESS.

Canonical root `C:/Users/user/Desktop/dentmarket-kz-main`, main,
HEAD7cec2fa42a1339dda9da868c13c417bce0ebaeb9 = origin/main. Сохранить5 прежних
WIP (.codex/project-session.json,4 legacy next-env) и AGENTS/Workflow policy WIP
другого обсуждения. Собственные dirty docs — CORE07 CI receipt/PRIMARY/Handoff.
Без агентов/worktrees, внешних сервисов, production запуска и изменений рабочей БД.

## Результат / DoD

- CORE08.1: сверка schemas→controller/OpenAPI→client для действующих CORE01–07
  сценариев. Закрыть конкретные найденные пробелы: email login/verify/reset и MFA,
  document upload, query/path metadata операторских действий, inline DTO клиента
  при уже существующей shared schema. Состав закрепить в contract regression;
  optional EXT endpoint inventory не выдавать за принятый CORE.
- CORE08.2: настоящий ESLint для исходников, отдельный от typecheck, с проверяемыми
  правилами корректности и обнаружением ошибочного кода. Без массового форматирования
  и stylistic rewrite. Root/workspace commands и CI должны запускать lint.
- CORE08.3: npm остаётся единственным менеджером; убрать неиспользуемый pnpm lock.
  Lockfile менять только для разрешённых dev-зависимостей lint. Не reinstall
  существующей среды ради повторения уже пройденного evidence.
- CORE08.4: размер JSON зависит от маршрута; крупный upload разрешён только для
  import/document/credential endpoints. Проверить Content-Length/chunked/encoded
  размер, canonical400/413 envelope и сохранение raw signed webhook bytes.
  Base64 ограничить до Buffer allocation; единицы файла20MB import/10MB docs
  едины между schemas/parser/policy. Существующие ZIP/rows/columns/PDF bounds
  сохранить и проверить по риску, не переписывать.
- CORE08.5: привести production/pilot/Swagger policy и tests в соответствие
  принятому ADR009 и ответу владельца Q01. Production требует явный go_live;
  внешние обязательные guards не ослаблять. Runtime Swagger предназначен для
  local/test; production docs routes не экспонировать. Live launch отдельно.

## Проверенная исходная граница

Global JSON32mb и urlencoded1mb в bootstrap.ts; raw webhooks1MB с исходными bytes.
FileUploadPolicyService проверяет decoded size только после Buffer allocation;
ImportFileParser повторно декодирует и использует20MiB вместо20MB policy.
ZIP resource/5,000 rows/100 columns/PDF bounds уже есть. Schemas base64 limits
28m/16m не являются точной границей decoded bytes. Поддержать легитимные uploads.

Все lint scripts — tsc либо отсутствуют у canonical web. ESLint не установлен.
Проверены официальные flat-config/type-parser docs и npm metadata: eslint10.11.0,
typescript-eslint8.71.0 совместимы с Node24/TypeScript5.9; это dev tooling.
pnpm references вне lock/archive не найдены. Удаление одного stale lock относится
к явно разрешённому CORE08 housekeeping, без удаления деревьев/данных.

MFA endpoints не имеют explicit OpenAPI response/body contracts, базовые auth
login/email verify/reset также неполны; document upload имеет shared input и
client response, но отсутствуют ApiCore annotations. OperationObject shared
schema уже есть, клиент использует inline DTO. Принятые контракты не переписывать.

## План проверки и лимиты

После каждого законченного backend поведения — focused tests до следующих
зависимых изменений: limits/HTTP parser, затем schemas/client/controller contracts,
затем config/Swagger. Контракты сначала, реализации/клиент затем.
Lint config проверяется и на реальных исходниках, и на небольших malformed
fixtures через ESLint API; source exclusions только generated/artifacts.

Завершение: affected unit suites + final types/API/schema/web builds при
изменённых входах; core-contract, runtime-split, production-config/auth/config
policy probes, HTTP payload regressions, lint. Для затронутых login/upload UI
использовать существующие targeted browser prerequisites на isolated test DB.
PG07 переиспользуется только пока domain/Prisma/tenant transitions не меняются;
при изменении этой границы добавить соответствующий gate. Полный CORE09 позже.
Публикация: self-review, diff/manifest/secret checks, scoped commit/push main,
remote exact SHA и actual CI. До green08 не начинать CORE09.

Попытки08 пока0; probe2m/server5m/command20m/suite45m; max3 на gate/блокер,
историю не сбрасывать. Только `dentmarket_audit_20260914` через db:test для writes.
Working150000 не применена; dev остановлен. Есть только test artifacts07.

## Вопросы / решения

Q01 RESOLVED владельцем02.10: «Сохранить текущие требования; подключение сервисов
и production-запуск оставить отдельным этапом». Ограниченный production pilot
с ослаблением внешних требований не выбран. Нельзя закрепить обход go_live
guards выбором pilot как новый разрешённый путь. Swagger закрывается в production
как внутренняя эксплуатационная граница; публичная API-документация не запускается.

## Evidence02.10,15:03+05

Shared20MB import/10MB document constants и точные base64 character bounds
реализованы. Общий decoder проверяет decoded length с padding до Buffer.from;
upload policy/import parser используют его, compliance/import service — constants.
Schema build1 PASS; focused allocation/file-policy/parser1 PASS40 tests.

HTTP JSON теперь1MiB по умолчанию, повышенный лимит только POST upload/import/
credential; исходные webhook bytes сохраняются без дополнительной копии.
Malformed/oversized parser errors преобразуются в безопасный canonical envelope.
HTTP/error-envelope1 PASS16 tests: реальные localhost ephemeral requests без БД,
Content-Length/chunked/gzip, maximum legitimate files, raw webhook hash, form bound.
Команды: `npm run build --workspace @marketplace/schemas`;
`npm test --workspace @marketplace/api -- src/platform/security/bounded-base64.spec.ts src/platform/security/file-upload-policy.service.spec.ts src/modules/imports/import-file.parser.spec.ts`;
`npm test --workspace @marketplace/api -- src/platform/http/request-body-policy.spec.ts src/platform/http/api-exception.filter.spec.ts`.
Новые schemas+API файлы ещё не прошли итоговые types/build/core/runtime/browser.
HEAD прежний7cec2fa, commit/push08 пока нет; test servers завершены.

Следующий шаг: auth/MFA/document/operator schema→OpenAPI→client gaps.

15:18+05: auth/MFA shared responses/typed client/OpenAPI и operator offset/type
metadata реализованы. Найден неверный прежний client upload response: фактический
Document не содержит expanded archive relations; добавлен UploadedDocument
контракт без изменения domain writes. Admin MFA/landing session используют shared
types. Schema build2 PASS; auth schema3/client5/controller+identity6 tests PASS1.
Runtime Swagger выделен: не регистрируется в production; environment запрещает
production pilot/implicit profile по ADR009. Config/Swagger11 tests PASS1.

ESLint10.11.0/typescript-eslint8.71.0 установлены как dev-only. Root/workspaces/CI/
release используют реальные correctness rules; typecheck отдельно. Stale pnpm
lock удалён. Lint1 FAIL только3 старых suppressions несуществующего react-hooks
plugin. Удалены именно неработающие директивы, пояснения lifecycle сохранены;
правила не ослаблялись. Lint2 PASS. ESLint API policy tests2 PASS1.
API typecheck1 PASS. Root completion types/build/gates ещё не запускались.

`npm audit --omit=dev --json` PASS0. Полный advisory inventory:5 dev findings
(3high/2moderate) в уже существующих NestCLI fast-uri3.1.6/cosmiconfig js-yaml4.3.1
и Vitest3.2.7/@vitest/mocker; эти узлы не добавлены lint diff. Никакого audit fix,
major Vitest upgrade или claim полной dependency security. Отдельный остаток,
runtime audit/CI threshold не затронут. install scripts redis-memory postinstall
заблокирован существующей npm policy, allowScripts не менялся.

Далее: affected suites/root types, core-contract(APIbuild), runtime/production
config probes; canonical web build и targeted login/upload browser на testDB.

15:25+05 completion: root typecheck1 PASS13 tasks/12packages; API all1 PASS537;
schemas169/client55/admin23/landing19 PASS. Schema/API/client/web builds1 PASS,
core-contract1 PASS59 explicit operations (321 inventory,57body/130response,
189components; optional EXT не объявлен полным). runtime-split1 PASS на том же
API build через node script; production-config1/auth-contract1 PASS, включая
production pilot/implicit rejection. Web bundle1 PASS24chunks/358,767gzip bytes.
E2E typecheck1/lint touched PASS после нового теста и CORS-before-parser reorder.

Browser1 FAIL: password-login и A15 file retry PASS, новый real maximum10MB upload
таймаут. Диагноз доказан runtime warning+Next16.3.8 source: rewrite clone truncates
на10MiB, хотя base64 файл10MB требует13.3MB. Не API дефект и не разрешение поднять
все API limits. Shared JSON caps вынесены в schemas; Next
`experimental.proxyClientMaxBodySize=IMPORT_UPLOAD_MAX_JSON_BYTES+1MiB`: весь легитимный
20MB import проходит, stream-chunk headroom позволяет API вернуть413 до truncation.
Source inspection показал, что Next отбрасывает весь chunk, пересёкший clone cap,
поэтому первоначальный вариант+1byte уточнён до проверок, без дополнительной попытки.
Ссылка API справки:
https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize.
Добавлена chunked proxy assertion. Browser1 runtime завершён, процессы очищены.
Нужны schema rebuild/focused HTTP, API rebuild(только shared cap import), webbuild2
из-за Next config, browser2; неизменные config/auth/domain suites reuse.

15:33+05: schema rebuild3 / HTTP targeted2 PASS11; API build2/web build2 PASS.
E2E typecheck2 и scoped lint обновлённых4files PASS. Browser2 PASS1/1:
реальный PDF10,000,000bytes через apps/web→API→storage→archive,
UploadedDocument response schema PASS; обычный oversizedJSON413 + chunked
oversized import413 через Next proxy. Команда `npm run db:test -- exec -- node
scripts/run-canonical-browser.mjs --config playwright.unified.config.ts --grep
"CORE08 maximum"`. Browser1 login/A15 PASS переиспользованы. Процессы завершены.
Все обязательные local gates08 PASS или обоснованный reuse. До публикации:
закончить self-review/staged manifest/secret/diff/docs checks, убрать только
собственный generated apps/web/next-env diff, commit/push и проверить actual CI.
CORE09 не начинался. Рабочая migration150000 не применялась, dev остановлен.

15:40+05 self-review PASS: contracts/callers, allocation/parser/raw webhook,
Next proxy, lint rules/fixtures, lockfile dev-only scope и CI commands сверены.
Working domain/Prisma transitions не менялись; PG07 REUSED_PASS, CI повторит PG.
Роли Code Reviewer/Git Workflow Master и development-toolkit применены для
проверки границ, staged состава и fast-forward; независимый агент не запускался.
Generated apps/web/next-env восстановлен. Foreign7 WIP исключены из staging.
`git diff --check` PASS; fetch origin/main совпал с HEAD7cec2fa, outgoing0.
Далее scoped commit/push и actual CI; локальный PASS не закрывает CORE08.

Публикация02.10:64591bcebb765378b7383df6243571925bb22498 в origin/main,
remote SHA проверен и совпадает. CI36996467232 и Security36996467259 IN_PROGRESS.
CORE09 пока только read-only сверка существующих проверок; записи реализации нет.

15:53+05: оба runs completed SUCCESS на64591bc. CI verify/PG/оба контейнера,
Security dependencies/CodeQL PASS. Полные unit/types/lint/build, contracts/config,
extended API и canonical FlowB3/browser прошли на той же ревизии. CORE08 CLOSED.
Разрешённый CORE09 начат отдельной карточкой; рабочая БД не изменялась.
