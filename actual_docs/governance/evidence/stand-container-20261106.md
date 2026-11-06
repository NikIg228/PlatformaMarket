# Локальный Docker и контейнерная приёмка — 06.11.2026

## Результат и разрешённая граница

Владелец поручил установить Docker локально, продолжить контейнерную проверку
и подготовку версии для стенда. Сервер и домен явно перенесены на следующий шаг.
Каноническая папка сохранена, main@5161af7f. Новые worktrees/клоны приложения,
облачные ресурсы, deployment и рабочие данные не создавались/не менялись.

**LOCAL_CONTAINER_PASS**: API/worker и unified web собраны и проверены в Linux.
Подготовлены локальные образы и [инвентаризация исходников](stand-container-20261106/source-manifest.json).
Это ещё не зафиксированный в Git и принятый общий release candidate: образы
включают ранее накопленный WIP, а не только изменения этого поручения.

Docker Desktop 4.98.0 установлен через официальный winget package с проверкой
installer SHA256, per-user, WSL2 backend. Engine29.9.2, Compose5.6.1,
linux/amd64. WSL3.0.1 и виртуализация уже имелись. На машине8ГБ RAM;
тяжёлые сборки пришлось завершать последовательно.

## Исправления, найденные реальным запуском

1. **Healthcheck API:** Alpine `wget localhost` получал Connection refused,
   хотя `127.0.0.1:4000/api/health/ready` возвращал ready. Production Compose
   переведён на IPv4 loopback, добавлена точная regression assertion.
2. **Queue startup race:** при рестарте worker сохранённое задание получало
   `No handler registered` и выполнялось только со второй попытки. Подключение
   очереди перенесено из `onModuleInit` в `onApplicationBootstrap`, после
   регистрации доменных handlers. Реальный Nest lifecycle regression сначала
   воспроизвёл дефект, затем прошёл. Финальный Redis/container сценарий с
   `attempts:1` завершился с `attemptsMade:1`.
3. В существующий Caddy boundary runner добавлены maximum-body и +1-byte cases;
   тестовый upstream обрабатывает ожидаемый ECONNRESET после отказа Caddy.

Это внутренний порядок запуска и эксплуатационная конфигурация; HTTP/domain
contracts, migrations, money/stock logic и UI не менялись. Новый UI не нужен.
Применены практики DevOps Automator: изоляция окружения, привязка артефактов,
readiness, порядок старта и recovery. Агентов не запускали.

## Итоговые образы

Полные IDs и размеры: [images.json](stand-container-20261106/images.json).

| Артефакт | Локальный tag | Размер |
| --- | --- | --- |
| API и worker | `platformamarket-api:stand-20261106-local2` | 1,294,977,960 bytes |
| Unified web | `platformamarket-web:stand-20261106-local1` | 418,446,501 bytes |
| Только S3 test fixture | `platformamarket-storage-fixture:20261106` | 459,309,659 bytes |

API image ID `sha256:9fdd059c82261f0b1be39834a90e5b4592461158c2f3e7fb7432d1d84bbad931`.
Web image ID `sha256:9955d2d38746ea6a609425649ab08b23a4424d824a738f947649e8717fc867ae`.
Profile `go_live`; публичные OAuth IDs/реальный origin пока не настроены.
Для серверного выпуска нужны согласованные build variables, зафиксированный
release SHA, CI этой ревизии и registry digests. Локальные tags не публикация.
Исторические образы не пересобирались ради сравнения размеров; процент
уменьшения относительно прежнего Dockerfile не заявляется.

## Проверки и доказательства

Все контейнерные записи — только в отдельном проекте `market-acceptance-20261106`,
БД `dentmarket_test_container_20261106`, Redis `fixture-redis` и private bucket
`container-acceptance`. Network internal, рабочие env/DB/uploads не монтировались.
API/worker/web используют read-only root и tmpfs `/tmp` из production Compose.
Локальные зависимости без TLS запускались с явным `NODE_ENV=test`; это fixture
профиль, а не ослабление production guard. Отдельная проверка доказала, что
production image отвергает такую конфигурацию.

- Docker builds api/web: PASS. Чистый `npm ci` внутри образов, без переустановки
  host dependencies. Обе установки внутри API build сообщили 0 vulnerabilities;
  это не новый полный security audit.
- `node deploy/stand-access/verify-compose.mjs`: PASS на финальном Compose.
  Только Caddy публикует ports, overlay и worker dependency сохранены.
- Оба Caddyfile: Linux `caddy adapt --validate` PASS. `verify-edge.mjs` с реальным
  Caddy: защищённые пути, login/body/static/webhook boundaries, fail-closed при
  отказе gate и body26,797,740/+1 bytes PASS.
- Prisma validate в read-only API image PASS; 57 migrations применены к новой
  disposable БД. Повторный migrate deploy: No pending migrations.
- При моделируемом отказе pre-start/migration stage API exit23, worker остаётся
  created, StartedAt=zero; не запускается вопреки dependency failure.
- API ready проверяет реальные PostgreSQL/S3/Redis. API не имеет consumer/cron;
  worker не слушает HTTP. При остановленном worker job остаётся waiting, после
  старта выполняется с первой попытки. Тестовый job удалён после проверки.
- PDF RU/KK 5386bytes, DOCX8704bytes созданы внутри read-only image. S3 put/get
  и signed download возвращают те же bytes; anonymous download403. Тестовые
  объекты удалены. Test/dev tool paths и исходный app отсутствуют в runtime;
  запись в `/workspace` отвергается EROFS.
- Web standalone: login200, три built static assets200, API proxy ready.
  Предельное тело импорта достигает API auth и получает401 в безопасном envelope;
  +1 byte возвращает413/PAYLOAD_TOO_LARGE. Это проверка транспорта/лимита, не
  приёмка реального импорта каталога или антивируса.
- Backend: `npm exec --workspace=@marketplace/api -- vitest run --dir src src/platform/jobs/background-queue.service.spec.ts src/modules/commerce/order-response.service.spec.ts`
  — 17 PASS. Notifications service и reservation-expiry-metrics — ещё13 PASS.
  API typecheck, scoped ESLint, `npm run verify:runtime-split` — PASS.
  `node --test scripts/canonical-delivery.test.mjs` после healthcheck fix —3 PASS.
  Ранее принятые release barrier tests не перезапускались: их inputs неизменны.

Точные runners, fixture Compose, команды и все попытки:
`.tmp/stand-container-20261106/`. Выбранные логи также сохранены в соседней
evidence-папке. Source manifest содержит2538 git-visible source/config files,
отфильтрованных Docker ignore; это не byte-exact экспорт Docker context.

## Не скрытые неуспешные попытки

- Первый daemon probe получил500 во время первоначального старта; после готовности
  daemon проверка прошла. API build1 не нашёл Docker credential helper в PATH;
  build2 с новым PATH PASS. Build3 после исправления очереди — final PASS.
- Web build1 прерван исполнителем из-за нехватки памяти при параллельной Go
  сборке. Web build2 без неё PASS. Старый запуск не объявляется успешным.
- `minio/minio` больше недоступен в Docker Hub, официальный binary URL вернул410.
  Test fixture собран из официального source commit
  `7aac2a2c5b7c882e68c1ce017d8256be2feea27f`, без сторонних зеркал. Это не выбор
  production storage. Старый local `compose.yaml` всё ещё ссылается на снятые
  MinIO images; для его отдельного запуска понадобится выбранная замена/source
  build. Production Compose использует внешнее хранилище и от них не зависит.
- Первый edge case прошёл max/+1 assertions, затем тестовый upstream упал на
  ECONNRESET; после исправления runner полная проверка PASS.
- PostgreSQL socket healthcheck увидел временный init server; identity probe
  попал на его shutdown. Fixture healthcheck переведён на TCP; финальная БД
  подтверждена по имени и57 applied migrations. Рабочая БД не использовалась.
- Runtime start1 timeout выявил реальный localhost/IPv6 defect; после IPv4 fix
  start2 PASS, финальные образы также PASS.
- Первый web smoke с Windows не достиг internal Docker network; внутри этой
  сети web/API сразу отвечали. Runner перенесён внутрь сети без её открытия;
  web smoke2 и final PASS.
- Queue lifecycle RED:1 FAIL/3 PASS до исправления; после исправления4/4PASS.
  Первый container recovery имел2 attempts; после fix — строго1.

## Cleanup, Git и оставшиеся границы

Удалены только контейнеры, network и два volumes собственного test project;
контрольный список project containers/volumes пуст. Образы и build cache
сохранены. Docker Desktop штатно остановлен после проверки для освобождения RAM.
Локальный `npm run dev` восстановлен: API4012 PID16508, web3000 PID5856,
API readiness и `/login` HTTP200. Owned dev session56251 остаётся включённой.

Прежние18 staged paths побайтно по staged diff hash сохранены. Commit/push/deploy
не выполнялись: весь диапазон7 outgoing commits и накопленный продуктовый WIP
не превращаются в принятый релиз по этому scoped container PASS. Инвентаризация
подготовлена, но общий Git release SHA ещё не зафиксирован. Полная функциональная
приёмка ранее открытых auth/session/UI пунктов не заявляется.

Сервер/домен — следующий согласованный этап. На нём остаются реальные HTTPS,
закрытый вход без обхода, role/tenant сценарии, provider/AV/TLS integration,
backup restore и rollback. Эти результаты нельзя заменить localhost/mock PASS.

Источники: [Docker Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/),
[Nest lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events),
[официальный MinIO source](https://github.com/minio/minio).
