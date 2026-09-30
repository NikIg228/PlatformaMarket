# Единый frontend: локальный запуск и границы перехода

Решение: [ADR 015](../architecture/adr/015-unified-frontend.md).
Состояние проверок: [checkpoint](../../../governance/task-state/UNIFIED-APPLICATION-2026-09-28.md).

После обычной настройки PostgreSQL, Redis, API env и существующей схемы:

```powershell
npm ci
npm run dev
```

Launcher запускает Nest API и один Next `apps/web`; адрес браузера
`http://127.0.0.1:3000`. Стандартный локальный профиль `go_live` сохранён;
`npm run dev:pilot` выбирает ограниченный `pilot`. API и workers сохраняют
действующую композицию; новый frontend не меняет доступность продуктовых модулей.
Порты 3000/4012 должны быть свободны. Чужие процессы не останавливаются.
Никакого seed или применения миграций launcher не выполняет.

Пути: `/catalog`, `/login`, `/register`, `/clinic`, `/supplier`, `/admin`.
Оператор входит через `/admin/login`; обычный вход не выдаёт его полномочий.
API браузера — `/api`; fixed upstream задаётся серверным `INTERNAL_API_URL`.
Это URL API с окончанием `/api`, без credentials/query/hash. При переносе
origin нужен повторный вход: cookies старых портов не мигрируются.

`npm run build` исключает четыре старых frontend из активной сборки.
Для одного web с зависимостями: `npx turbo build --filter=@marketplace/web...`.
`npm run start --workspace=@marketplace/web` запускает production-артефакт;
API запускается отдельно. Docker target `web` использует тот же новый build;
его внутренний API endpoint настраивается до сборки, поскольку Next rewrites
фиксируются в артефакте. Контейнерный выпуск и production ingress ещё не приняты.

Исходные компоненты временно остаются в старых app-каталогах. Новый Next
импортирует их напрямую; старые HTTP-процессы для него не нужны. Assets и
изолированные auth styles создаёт `prepare-unified-web.mjs`; generated/public
в `apps/web` не редактируются вручную и не коммитятся. Turbo учитывает исходные
каталоги компонентов и assets при проверке cache.

## Откат

Штатно остановить собственный unified launcher (`Ctrl+C`), убедиться, что его
порты освобождены, затем `npm run dev:legacy`. Для старых сборок —
`npm run build:legacy`. Это возвращает прежние четыре web-процесса и gateway
без отката схемы или данных. Старые Docker targets сохранены отдельным build.
Реальный пробный запуск всего legacy runtime в текущей приёмке не выполнялся.

## Проверки и следующие границы

`npm run typecheck`, `npm test`, scoped `playwright.unified.config.ts`,
`node --test scripts/unified-frontend.test.mjs scripts/local-development-profile.test.mjs`
и web build. Браузерные fixtures пишут только в разрешённую disposable test DB.
Стандартный legacy `verify:web` пока остаётся отдельной исторической приёмкой;
узкий unified smoke не заменяет весь набор продуктовых сценариев.

До production: согласовать origin оператора/домены, включить новый web в release
pipeline вместо старой матрицы, принять Docker/ingress, ограничения uploads и
streaming, полную матрицу прав/отзыва/многовкладочности, миграцию внешних ссылок
и пробный rollout/rollback. CI/release сейчас не запускались: push отложен
владельцем. Новые внешние интеграции и отложенные оплаты не входят в переход.
