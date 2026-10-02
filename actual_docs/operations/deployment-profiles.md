# Deployment profiles и реальная топология

Сверка30.09.2026: [ADR009](../architecture/adr/009-deployment-profile-composition.md),
[ADR011](../architecture/adr/011-local-full-feature-demonstration.md),
[ADR015](../architecture/adr/015-unified-frontend.md).

DEPLOYMENT_PROFILE определяет Nest module graph и build-time frontend features.
Без переменной прямой API/shared contract выбирает pilot. Локальный launcher
явно использует go_live, кроме dev:pilot/явного pilot. Go_live локально не
означает production, новые провайдеры или реальные списания.

| Профиль | Поверхность |
| --- | --- |
| pilot | Procurement core/catalog/cart/orders/logistics/documents/notifications/geo/operations |
| go_live | Pilot плюс promotions/billing/AI/trust/reviews/smart recommendations в пределах имеющейся реализации и прав |

## Основной локальный runtime

С02.10.2026 локальный launcher временно выбирает `ACCESS_CONTROL_MODE=FULL_ACCESS`
для всех трёх кабинетов по [ADR017](../architecture/adr/017-temporary-local-full-access.md).
Назначенные роли сохраняются, активным сотрудникам доступны все функции своей
организации. Для возврата ролевых ограничений перед `npm run dev` задать
`$env:ACCESS_CONTROL_MODE = 'ROLE_BASED'` и перезапустить собственный launcher.
Для возврата к полному доступу — `FULL_ACCESS`. JWT/tenant/capability не отключаются.
Прямой API и CI по умолчанию остаются `ROLE_BASED`; production отвергает FULL_ACCESS.

npm run dev / dev:local — API4012 и apps/web3000; вход /login, оператор
/admin/login. /catalog, /clinic, /supplier, /admin работают на одном origin.
AUTH_MODE=jwt; проверяются реальные сессии/membership, demo headers обычным
launcher запрещены. Перед стартом проверяются миграции/данные/readiness;
миграция, reseed или продление freshness не выполняются автоматически.
API предварительно собирается и запускается без watcher; dev:watch-api включает
его явно. Детали — [Local DB](../runbooks/LOCAL-DEV-DATABASE.md).

Frontend получает фиксированный /api upstream из INTERNAL_API_URL; config
отклоняет неподходящий URL. Build-time профиль согласован с API; конфликтующий
NEXT_PUBLIC_DEPLOYMENT_PROFILE отвергается. Смена профиля требует пересборки.
Нельзя одновременно dev/build в одной .next или останавливать чужой launcher.

## Legacy и production

dev:legacy/dev:all и отдельные dev:buyer/supplier/admin/landing сохраняют старый
режим: admin3000, buyer3001, supplier3002, landing3003 и gateway3080 при полном
запуске. Они не описывают обычный npm run dev. ADR014 междоменная часть заменена
ADR015; scoped sessions/cookies/CSRF/revocation не отменены.

npm run build исключает четыре legacy apps; build:legacy собирает их отдельно.
Docker и release matrix используют api/web; API image собирается отдельно от
Next. Compose содержит api/worker/web/caddy, ingress ведёт WEB_DOMAIN на web3000,
а /api на api4000. Профиль задаётся при сборке обоих образов. Старые Docker
targets и compose.production.legacy.yaml с Caddyfile.legacy сохранены для
явного отката к ранее выпущенным legacy images; новая release matrix их не выпускает.
Конфигурация выпуска не означает production rollout: домен, provider callbacks,
операторский origin и live rollout/rollback требуют отдельной приёмки.

Production требует явный `DEPLOYMENT_PROFILE=go_live` и отдельные api/worker
roles. `pilot` и отсутствие профиля отклоняются по ADR009; обязательные guards
провайдеров, MFA, TLS и shared rate limiting сохраняются. Локальные pilot/go_live
по-прежнему допустимы. Swagger UI/JSON/YAML доступны только вне production;
production bootstrap не регистрирует `/docs`, `/docs-json` и `/docs-yaml`.

## Проверки

verify:local-profile, verify:frontend-profile и verify:pilot-composition —
разные контракты. Они не заменяют browser acceptance apps/web. verify:web
запускает canonical unified suite; прежний набор доступен через verify:web:legacy.
Конфигурации указаны в [runbook](../runbooks/UNIFIED-FRONTEND.md).
Выбирать только нужные gates по Workflow; базы fixtures — disposable.
Фактический CI и limits — [Matrix](../governance/PROJECT_ACCEPTANCE_MATRIX.md).

Production provider/config/backup/load evidence — отдельные operations runbooks.
Сохранены fail-closed требования, и ни один provider не становится LIVE_VERIFIED
от profile flag, health endpoint или локального mock PASS.
