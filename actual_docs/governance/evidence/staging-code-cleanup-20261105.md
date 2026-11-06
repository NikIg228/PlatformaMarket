# Подготовка состава приложения для staging — 05.11.2026

## Поручение и план до реализации

Владелец разрешил предложенную структурную очистку после read-only ревизии.
Цель — воспроизводимая компактная поставка на staging VM, не production deploy.
Каталог, изображения, описания, характеристики, рабочая и тестовая БД сохраняются.
Не менять бизнес-поведение, не выполнять миграции/seed/внешние вызовы.
Канонический корень dentmarket-kz-main, main@5161af7f; предыдущий staged/unstaged
WIP других задач сохраняется. Новые агенты/чаты не запускаются.

1. Исключить диагностические материалы и производные локальные файлы из Docker
   context. Разделить build/runtime, оставить миграционный CLI и ресурсы API;
   web использовать standalone output с обязательными public/static.
2. Отделить тесты от API build, сохранив typecheck/tests и исполняемые probes.
3. Повторно проверить девять кандидатов без consumers; удалить только их чистые
   исходники. Не удалять legacy applications, rollback, serverless ingress без
   подтверждения внешних consumers. Удалить неиспользуемую pnpm-конфигурацию,
   не менять выбранный npm или версии зависимостей ради housekeeping.
4. Добавить ограниченную очистку старого Turbo cache: dry-run по умолчанию,
   точный разрешённый root, возраст, запрет symlinks и работающих build процессов.
   Старые test build trees автоматически не удалять: они могут быть нужны
   незавершённой приёмке. Никакой автоматической уборки БД/public/.tmp целиком.

Риски: потеря runtime dependency/Prisma/native engine/fonts, несовместимость
standalone с монорепо, удаление косвенного consumer, выход cleanup за границы.
Проверки: focused packaging/cleanup tests; API build/types и runtime probes;
web/affected frontend types/build, существующий bundle budget; diff hygiene,
сохранность чужого WIP и исходных public/data. Не расширять до полного E2E
без показанного изменения пользовательского поведения.

Обязательная контейнерная приёмка: build api/web и isolated smoke/runtime checks.
Preflight: команда docker отсутствует (attempt1). Docker не устанавливается,
CI/container PASS не заявляются. Независимые локальные этапы можно подготовить;
общая приёмка образов остаётся BLOCKED до доступной Docker-среды.

Практики: development-toolkit, review/cleanup, execution/verification. Проектные
правила приоритетны над устаревшими ссылками профиля skill. Визуальный редизайн
не выполняется; удаляются только компоненты без достижимых потребителей.

## Результаты

Локальная подготовка выполнена; результаты и незавершённая контейнерная
приёмка подробно зафиксированы ниже.

## Продолжение по шести пунктам — 05.11

После read-only проверки владелец явно поручил пройти все шесть пунктов,
без изменения работающей версии и каталога; старый Vercel-путь больше не нужен.
Поручение относится к обсуждённому vercel.json (в сообщении «universal.json»).
Прежняя реализация Docker/build/dead-file removal сохранена, не приписывается
этому продолжению. Сверены исходники, Git main@5161af7 и предыдущий checkpoint.

До новых изменений: удалить только чистые Vercel config/ingress файлы после
проверки ссылок; сохранить bootstrap serverless option, используемый HTTP probes.
Доработать безопасное хранение Turbo cache (dry-run, возраст, лимит, идентичность
файлов, отказ при symlink/активном build), добавить тесты в disposable directory.
Разделение schema build дополнить безопасной упаковкой только runtime outputs,
без попыток повторить отклонённое удаление локального schema dist.
Для runtime сохранить исходный public-resource fallback; полноценное image smoke
остаётся BLOCKED без Docker. Подготовить operational guide с приёмкой и границами.
Никаких новых бизнес-изменений, удаления данных/общего .tmp, установки Docker,
запуска заблокированного frontend или публикации чужого WIP.

Checks: переиспользовать подтверждённые API/schema/web builds и API/schema types,
runtime-split/config gates при неизменённых входах; выполнить оставшиеся frontend
types, web bundle, packaging/canonical tests и cache regressions. Финальные
scoped lint/diff, проверка lock versions и сохранности public/data/index.

## Результат продолжения

Все шесть пунктов обработаны в согласованной локальной границе; контейнерная
приёмка остаётся BLOCKED, поэтому overall ACCEPTED/commit/push/deploy нет.

1. Сохранены подготовленные отдельные API/web runtime stages. Дополнительно
   скопирован buyer public resource path для существующего storage fallback;
   обязательный S3 production guard не менялся. Prisma CLI остаётся production
   dependency, engine/schema/migrations/fonts и worker entry присутствуют.
2. Исключения Docker context сохранены и проверены. `output`446.2MiB остаётся
   локально; каталог и изображения не удалены.
3. Разделение API/schema build/typecheck сохранено. API dist содержит0spec.js.
   Runtime probes на месте. Старые локальные schema outputs не удалялись:
   прежний policy-denial не обходился; чистый Docker build не копирует dist.
4. Проверено ранее подготовленное удаление9modules+1privateCSS. Нет найденных
   consumers по paths/exports; shared compact-catalog.module.css и товарный
   page.module.css сохранены, их действующие consumers найдены. Никакого
   удаления используемых legacy application directories или каталога.
5. По новому явному решению удалены11чистых Vercel-файлов: root vercel.json,
   vercel.api.json, .vercelignore, apps/api/vercel.json, apps/buyer-web/vercel.json,
   root api/index.{js,ts}, api/[...path].{js,ts}, apps/api/api/index.ts и
   apps/api/api/[...path].ts. pnpm deletion из предыдущего этапа сохранён.
   bootstrap serverless option оставлен: три HTTP verification scripts его
   используют. Внешние deployments/проекты не менялись. Rollback Compose intact.
6. Добавлены cache:prune(dry-run) и cache:prune:apply. Только известные пары
   root Turbo cache, возраст30дней/бюджет2GiB с защитой последних7дней;
   process check, lock, symlink/junction refusal, stamp recheck. Тестовые fixtures
   создавались/убирались только в выделенных `.tmp/cache-retention-test-*`.
   Реальный dry-run: cache отсутствует,0bytes/0candidates; apply не нужен и
   не запускался. Политика run-owned generated artifacts документирована без
   автоматического удаления чужих/незавершённых сборок или всего `.tmp`.

### Проверки и evidence

REUSED_PASS при неизменённых соответствующих входах предыдущего этапа:
schema build1, API build1, API/schema types1, runtime-split1, production-config1,
unified web build1 (завершён успешно, standalone server output проверен).
Логи `.tmp/staging-cleanup-{schemas-build-1,api-build-1,api-types-1,runtime-1,
production-config-1,web-build-1}.log`. Next generated types imports восстановлены
из `.tmp/staging-cleanup-next-env-before.json`; исходный файл сохранён.

Новые проверки:
- `node --test scripts/staging-packaging.test.mjs scripts/canonical-delivery.test.mjs scripts/unified-frontend.test.mjs`:
  9PASS, continuation attempt3 общего журнала. Предыдущие attempt1FAIL на
  Windows path assertion и attempt2PASS8 сохранены; новая проверка Vercel retirement.
- `node --test scripts/turbo-cache-retention.test.mjs`: attempt1 5PASS; после
  добавления direct compiler/test process detection attempt2 6PASS; source review
  добавил проверку identity заменённого directory и lock, attempt3 7PASS. Проверены
  dry-run, apply только старых complete pairs, fresh metadata, byte budget,
  активный build/ошибка process check, изменённый файл, чужой lock, junctions,
  отсутствие cache, замена directory и invalid settings. `.tmp/staging-cleanup-cache-{1,2,3}.log`.
- `npm run cache:prune`: PASS, ничего не удалялось;
  `.tmp/staging-cleanup-cache-dry-run.log`.
- `npm run typecheck --workspace=@marketplace/buyer-web --workspace=@marketplace/admin-web --workspace=@marketplace/web`:
  3PASS1, `.tmp/staging-cleanup-frontend-types-1.log`.
- `node scripts/verify-web-bundle.mjs`: PASS1, прежние budgets не ослаблены;
  `.tmp/staging-cleanup-web-bundle-1.log`.
- `npm exec -- eslint scripts/prune-turbo-cache.mjs scripts/lib/turbo-cache-retention.mjs scripts/turbo-cache-retention.test.mjs scripts/staging-packaging.test.mjs apps/web/next.config.ts --max-warnings=0`:
  PASS1, `.tmp/staging-cleanup-lint-1.log`; после directory-identity fix повторён
  scoped ESLint двух изменённых cache-файлов, результат в lint-2.log.
- Local built-artifact smoke: compiled document renderer создаёт PDF RU/KK
  (3841bytes) и DOCX(8625bytes); API/worker/probes/fonts и standalone server
  существуют. Все lockfile versions совпадают сHEAD;479data/public source hashes
  совпадают с baseline. `.tmp/staging-cleanup-artifact-smoke.json`, attempt2PASS.
  Attempt1: эти проверки прошли, но raw `.git/index` byte hash не совпал с
  историческим. Такой hash включает служебное состояние Git и не доказывает
  изменение staged content; вместо ложного утверждения «index unchanged»
  отдельно сверены18staged paths с preflight. Ни add/commit/reset, ни изменение
  staged содержимого этим продолжением не выполнялись.

Source hash comparison выявил только согласованные cleanup paths относительно
baseline; чужой product/docs WIP сохранён. Runtime/prod commands не запускали
рабочую БД; текущие данные и процессы приложения не менялись. Docker CLI не
найден ни в PATH, ни в стандартном install path; image sizes/container smoke
NOT_RUN. Это остаётся обязательным следующим шагом в доступной Docker-среде,
с disposable сервисами. Нет установки Docker, обхода frontend-policy,
общего E2E, новых агентов, staging deployment или публикации7outgoing commits.

Эксплуатационная инструкция: [staging-artifact-hygiene](../../operations/staging-artifact-hygiene.md).
