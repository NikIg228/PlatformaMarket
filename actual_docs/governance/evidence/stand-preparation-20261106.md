# Подготовка закрытого стенда — 06.11.2026

## Поручение и граница

Владелец вернул исполнение к ранее перечисленным задачам подготовки стенда:
состав версии, три конфигурационных исправления, Linux/container acceptance,
изолированное окружение, развёртывание и серверные проверки. Отчёт только по
Support не закрывал это поручение. Новая продуктовая фаза не запускается.

План до реализации: согласовать ingress с существующим import JSON contract;
заблокировать первый запуск worker до завершения миграций; проверять CI того же
SHA перед публикацией. Риск: отказ допустимого импорта, запуск на старой схеме,
выпуск непроверенной ревизии. Проверки: focused Node tests, scoped lint,
production config contract, затем Compose/Caddy и Linux runtime в disposable
окружении. UI и рабочие данные не меняются. Применён checklist DevOps Automator:
связь CI/artifact, порядок старта, секреты вне образа, readiness и rollback.

## Локально реализовано

- `infra/Caddyfile` и `deploy/stand-access/Caddyfile`: 26,797,740 bytes,
  ровно `ceil(20,000,000 / 3) * 4 + 131,072`. Меньшие API route limits сохранены.
- `compose.production.yaml`: worker зависит от API `service_healthy`.
  API исполняет migrations через `&&` до HTTP startup. Ошибка миграции не даёт
  readiness и не разрешает первый запуск worker. Это не runtime supervisor;
  порядок остановки прежнего worker при upgrade описан в deployment runbook.
- Release: отдельный job читает последний main/push run `ci.yml` для точного
  SHA. Missing/pending/failure/cancelled/API error запрещают публикацию.
  Старый success не перекрывает новый failure. Image job checkout использует
  проверенный SHA; добавлен `sha-<SHA>` tag. Digests нужны отдельно: tag mutable.
- В CI добавлены regression tests, проверка merged stand Compose и stand Caddy.
  Публикация или dispatch workflow этим изменением не выполнялись.

## Проверки

1. `node --test scripts/canonical-delivery.test.mjs scripts/verify-release-ci.test.mjs`
   — 8 PASS, первая попытка.
2. `npm exec -- eslint scripts/verify-release-ci.mjs scripts/verify-release-ci.test.mjs scripts/canonical-delivery.test.mjs deploy/stand-access/verify-compose.mjs --max-warnings=0`
   — exit0.
3. После добавления CI stand validation, completion check:
   `node --test scripts/staging-packaging.test.mjs scripts/production-readiness.test.mjs scripts/canonical-delivery.test.mjs scripts/verify-release-ci.test.mjs`
   — 20 PASS. Packaging/readiness проверены впервые в этом поручении.
4. `node scripts/verify-production-config.mjs` — exit0; production guard
   принимает полную fixture configuration и отвергает небезопасные варианты.
   Это проверка built environment contract, не live providers/server.

Не менялись TS applications/contracts, поэтому новые application builds/types
не запускались. Полный release gate прежних 185 source/config WIP paths не
подменяется этими scoped checks.

## Состав версии: инвентаризация, не принятый release candidate

`git fetch origin main` успешен. HEAD `5161af7f83f909ad90901de403daa3f7fde0e928`,
origin/main `4543fd22c92464bb72fe75a627bb225adb921fde`, ahead7/behind0.
Существующие 18 staged paths сохранены; add/reset/commit/push не выполнялись.
Семь outgoing commits и рабочие файлы зафиксированы в
`.tmp/stand-preparation-20261106/{outgoing.txt,status.txt,existing-index.txt,working-tree-inventory.json}`.
Inventory содержит 633 уникальных изменённых/неотслеживаемых пути:
185 source/config, 318 documentation, 130 evidence-only; для существующих файлов
записаны SHA256, для удалённых null. Это снимок до добавления данного отчёта,
не утверждение, что каждый путь следует включать в поставку.

Предлагаемый состав: текущие согласованные runtime/product исправления и
конфигурация стенда; исторические screenshots/output и локальные credentials
не должны становиться runtime image. Существующий Docker context policy это
проверяет. Предыдущий Dockerfile/lock/source WIP не присваивается этому patch.
До фиксации RC нужно завершить review базового набора и его незакрытых gates,
затем записать commit SHA, image digests и config/schema version.

## Незакрытые результаты и внешние входы

- **Linux/container acceptance BLOCKED:** Docker отсутствует в PATH и штатном
  Windows install path. Это известный blocker прошлого прохода, не новый
  неуспешный build; повторные build attempts не запускались. Нужна доступная
  Docker/Linux среда. Образы, read-only root, Prisma engine/migrations, реальный
  порядок старта и HTTP ingress предельного размера ещё не приняты.
- **Окружение/деплой NOT_RUN:** выбран Yandex Cloud, но не указан доступный
  сервер/SSH alias и домен. Эти данные запрошены у владельца. Требуются отдельно
  disposable DB, TLS Redis, private encrypted bucket, AV и sandbox endpoints,
  подходящие действующему go_live contract. Секреты не запрашиваются в чате.
- **Серверные проверки NOT_RUN:** закрытый HTTPS без обхода, реальные role/tenant
  сценарии, upload/download, worker recovery, backup restore и rollback остаются
  обязательными на выбранном окружении. Local FULL_ACCESS не переносится.
- **Публикация NOT_RUN:** нельзя считать весь текущий WIP принятым релизом или
  публиковать семь исходящих commits только по scoped infrastructure tests.

Следующий конкретный шаг: получить доступную Linux/Docker среду и домен,
провести контейнерную приёмку согласованного набора без рабочей БД, затем
продолжить подготовку окружения и серверную проверку. Без одобрения отдельного
контракта не ослаблять production guards ради стенда.

Технические основания: [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/),
[GitHub workflow runs API](https://docs.github.com/en/rest/actions/workflow-runs),
[Caddy request body](https://caddyserver.com/docs/caddyfile/directives/request_body).
