# Состав поставки и хранение сборочных файлов

Решение владельца05.11.2026: поддерживаемый путь — единый web и API/worker на VM.
Устаревшие Vercel-конфигурации и их serverless entrypoints удалены. Это изменение
репозитория, не удаление внешних проектов/доменов и не deployment.
Прежние версии доступны в Git. npm остаётся единственным package manager;
pnpm-workspace.yaml удалён. Legacy Compose/Caddy сохранены для отката с их
соответствующими immutable images, не для сборки нового релиза.

## Docker

- `workspace`, `api-build`, `unified-build` — сборочные стадии с dev-зависимостями.
- `api` — отдельный runtime: production npm dependencies, Prisma client/engine,
  CLI/schema/migrations, API/schema dist и исходные buyer public assets для
  сохранения существующего resource fallback. Шрифты и лицензия входят в API dist.
  Тот же образ запускает worker. Production storage guards не изменены:
  обязательное зашифрованное S3-compatible хранилище, не локальный fallback.
- `web` — standalone output с `apps/web/server.js`, public и `.next/static`.
  Исходные public assets берутся из buyer/landing/supplier; generated web public
  и generated auth CSS заново формируются `prepare:web`.
- `output`, `outputs`, `.tmp`, `.turbo`, тестовые отчёты и tsbuildinfo исключены
  из контекста. Локально evidence не удаляются. Каталог/data и исходные public
  assets не исключаются и не очищаются.

Контейнерная приёмка обязательна до публикации этих изменений: build `api`/`web`
из канонического checkout, размеры образов и сравнение одинаковых targets,
проверка отсутствия dev tools/test outputs, запуск API/worker/web, подключение
к disposable DB/Redis/S3, миграции только этой БД, создание/скачивание документа,
web public/static и API proxy. Проверить Prisma engine и запуск миграционного CLI
с read-only root filesystem из production Compose. Не использовать рабочую БД.

Локальные build/types/packaging tests не заменяют эту проверку. На05.11 Docker
недоступен; image build, размеры и container smoke не подтверждены.

## Компиляция

`apps/api/tsconfig.build.json` исключает `*.spec.ts` и `*.test.ts`, сохраняя
`main`, `worker` и используемые runtime probes. Исходный tsconfig и typecheck
продолжают включать тесты. Аналогично разделена сборка `packages/schemas`.
API build очищает свой output штатным Nest build. Docker не копирует локальные
dist и строит outputs с нуля. Локальный старый schemas/dist может содержать
исторические test outputs: их удаление ранее отклонено средой, обхода нет.

## Turbo cache

Из корня репозитория:

```text
npm run cache:prune
npm run cache:prune:apply
```

Первая команда только печатает план. Вторая применяет ту же политику:
только полные пары `<hash>.tar.zst`/`<hash>.meta.json` в корневом `.turbo/cache`.
Записи старше30дней удаляются; для бюджета2ГиБ сначала удаляются старейшие
записи не моложе7дней. Возраст пары определяется более свежим файлом.
Параметры можно передать через `-- --max-bytes N --min-age-days N --max-age-days N`.

Свежие, неполные и неизвестные записи сохраняются. Если они мешают уложиться
в бюджет, команда явно возвращает `budgetSatisfied: false`; это не разрешение
удалить их принудительно. В отчёте учитываются обычные файлы верхнего уровня,
не произвольные вложенные каталоги. Другие кэши этой командой не управляются.

Не запускать apply параллельно с build/dev/tests. Проверка процессов запрещает
очистку при обнаружении таких процессов; ошибка проверки тоже останавливает
операцию. Скрипт не останавливает процессы. Отдельный lock исключает второй
prune; перед удалением перепроверяются directory identity и stamps файлов.
Symlink/junction roots запрещены; linked entries пропускаются. Удаляются файлы,
не деревья. Прерванная очистка может оставить lock: сначала проверить, что её
процесс завершён, затем разбирать конкретный lock вручную; автоматического
удаления чужого lock нет.

## Сборки проверочных запусков

Для нового проверочного запуска заранее фиксировать его ID, точные каталоги,
процессы и файлы evidence. Временные сборки держать отдельно от логов/скриншотов.
После завершения принадлежащих запуску процессов удалять только его заранее
зарегистрированные generated paths, проверив абсолютный путь внутри workspace.
Для BLOCKED/незавершённого запуска сборки сохранять до решения по его приёмке.
Не применять эту процедуру задним числом к неизвестным `.tmp` деревьям.

Общая автоматическая очистка `.tmp`, БД, uploads, public/data, логов и screenshots
не вводится. Наличие большого каталога не доказывает, что он больше не нужен.

Проверки и ограничения: [staging cleanup evidence](../governance/evidence/staging-code-cleanup-20261105.md).
