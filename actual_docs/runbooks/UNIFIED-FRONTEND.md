# Единый frontend: локальный запуск и границы перехода

Решение: [ADR 015](../architecture/adr/015-unified-frontend.md).
Состояние проверок: [Acceptance Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md).

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
фиксируются в артефакте. Release matrix теперь api/web; production Compose и
Caddy используют единый WEB_DOMAIN с /api на api4000. Эта конфигурация проверяется
отдельно от live deployment, который ещё не принят.

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
Для production legacy images используется compose.production.legacy.yaml и
infra/Caddyfile.legacy с прежними доменами. Применять только проверенный ранее
выпущенный legacy tag: новый release выпускает api/web. Реальный пробный rollout/
rollback и перенос cookies/origins требуют отдельной приёмки.

## Проверки и следующие границы

`npm run typecheck`, `npm test`, `npm run verify:web`,
`node --test scripts/unified-frontend.test.mjs scripts/local-development-profile.test.mjs`
и web build. Браузерные fixtures пишут только в разрешённую disposable test DB.
verify:web через db:test проверяет адрес/имя disposable DB, выбирает существующего
synthetic public buyer и запускает собственные API4012/web3000 с JWT/pilot.
Занятые порты блокируют старт; dev-сервер не переиспользуется. Основной набор:
unified-application, public-catalog, workspace-rebuild, supplier-capabilities.
Legacy набор сохранён как verify:web:legacy. FlowB3 в основном CI также использует
apps/web: публикация оператором с настоящим fixture JWT, публичный каталог и
прежние API assertions импорта/отката. API-only части сохраняют development
actor headers только на собственном isolated test API; browser использует JWT.
Старый вариант доступен через verify:flow-b3:legacy, включая прежние build budgets.
Это не полная продуктовая приёмка POST-FULL.

После production build `npm run verify:web-bundle` проверяет JS manifests обоих
public catalog entries: максимум24 файлов,1,500,000raw/450,000gzip bytes. Лимит
не повышался. Это консервативный граф client modules; фактические network bytes
измеряет e2e:performance (3cold/warm samples на390/1440), а не этот manifest.

До production: согласовать origin оператора/домены, принять Docker/ingress в живой
среде, ограничения uploads и
streaming, полную матрицу прав/отзыва/многовкладочности, миграцию внешних ссылок
и пробный rollout/rollback. Код опубликован30.09 в2a816c3; CI и dependency
audit завершились FAIL, CodeQL PASS. Release/deployment не запускались. Новые внешние интеграции и отложенные оплаты не входят в переход.
