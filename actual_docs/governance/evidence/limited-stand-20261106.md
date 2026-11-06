# Ограниченный тестовый стенд Market — 06.11.2026

Основание: явное поручение владельца развернуть Market на существующей ВМ,
отключить реальные платежи/внешние отправки, сохранить защиту входа и CRM.
Baseline: `3d6702088cc4a5a4bdc7f8aea8a68b39ea85b482`.

Результат: **LIMITED_STAND_RUNTIME_PASS**. Это приёмка закрытого стенда с
синтетическими данными, не подтверждение коммерческой production-готовности.
[Границы режима](../../architecture/adr/019-limited-test-stand.md),
[порядок развёртывания и отката](../../../deploy/limited-stand/README.md).

## Проверки приложения

- После связных изменений выполнялись конфигурационные и boundary-тесты.
  Итоговый затронутый API-набор: 515 PASS, 1 штатный PostgreSQL-only skip.
- API typecheck, компиляция Nest и Linux API image: PASS. Windows prebuild
  первоначально остановился на блокировке Prisma DLL; чужие процессы не завершались.
  Полный Linux build с `prisma generate` затем прошёл.
- `verify-production-config.mjs`, runtime split, canonical delivery/release
  validator: PASS. Обычный production по умолчанию сохраняет обязательные интеграции.
- `npm run verify:release`: PASS в изолированном Linux-контейнере с явными
  нерабочими DB/Redis адресами и pilot test profile. Внутри одноразового контейнера
  Turbo typecheck/test ограничены `--concurrency=1`, `VITEST_MAX_WORKERS=1`,
  `NODE_OPTIONS=--max-old-space-size=3072`. Исходный package.json не изменён;
  команды/набор проверок не сокращались. 13 typecheck tasks, 2299 unit tests PASS,
  9 штатных DB-only skips; build, production readiness и rate-limit/auth gates PASS.
- Первые три запуска release-gate не завершились: два сбоя Docker при исчерпании
  памяти и один Node heap OOM при лимите 1800 MiB. Четвёртая попытка отдельно
  разрешена владельцем и завершилась с exit 0. Неуспешные логи сохранены.
- После полного gate визуальная проверка выявила обрезанный toast ошибки MFA
  на мобильном экране. Единственная последующая правка приложения:
  `DmFeedback presentation="inline"`. Повторены lint, 37 целевых auth/restoration
  tests, go_live web image build с TypeScript и затронутые browser checks: PASS.
  Неизменённые backend/config результаты переиспользованы по proportional policy.
- Параметризация домена в deploy templates: Compose equivalence с конфигурацией
  ВМ, `verify-compose.mjs`, Node syntax и shell syntax: PASS. Адрес и секреты
  сохранены в приватной конфигурации ВМ, не в Git.

## Приёмка работающего стенда

- Семь отдельных сервисов Market; закрытая сеть без опубликованных портов;
  общий cgroup 4 GiB RAM / 2 CPU. БД, Redis, файлы и секреты CRM не используются.
- PostgreSQL/Redis TLS, API readiness, неверный пароль, анонимный запрос,
  JWT, роли и запрет подмены организации: PASS.
- Реальный вход оператора, обязательная MFA покупателя/поставщика: PASS.
  Браузер: RU 1440 px и KK 390 px, autofocus, клавиатурная отправка, неверный
  код, смена аккаунта, правильный TOTP и открытие нужного кабинета: PASS.
  Ошибка формы не обрезается на мобильном viewport; скриншоты просмотрены.
- Отдельные browser UI probes с перехваченными синтетическими MFA-ответами:
  сбой загрузки/повтор, показ enrollment/recovery codes, защита от двойной отправки,
  отказ переходить в кабинет без elevated token, отмена: PASS. Они проверяют UI,
  не заменяют реальную серверную проверку TOTP и не меняют фактор аккаунта.
- HTTPS проверен без отключения TLS validation. Gate защищает страницы, API и
  реальные JS assets. Cookie Secure/HttpOnly/SameSite, forged JWT и development
  headers denied: PASS.
- Внешние mail/payment callbacks отклоняются до эффекта, чистый файл проходит
  AV, EICAR отклонён, интернет-egress контейнера заблокирован: PASS.
- Worker recovery: задача пережила остановку только Market worker и завершилась
  после запуска; ровно одна доставка IN_APP: PASS.
- Backup/restore: дамп восстановлен в отдельную временную БД; совпали 3 users,
  3 organizations, 2 MFA factors и 58 migrations. Архив файлов/конфигурации
  сохранён с закрытыми правами и SHA256. Временная restore DB удалена проверкой.
- Web rollback: прежний pinned image запущен и обслужил login, затем восстановлен
  текущий image. Остальные шесть Market container IDs/StartedAt не изменились.
  Повторная ingress-проверка после восстановления: PASS.
- CRM: три хеша конфигурации/секретов совпали, исходный Caddy block сохранён
  побайтно, MainPID/InvocationID/ActiveState пяти исходных сервисов совпали,
  CRM HTTPS 200. Добавление Market потребовало reload общего Caddy, без restart CRM.

## Артефакты и границы

API image: `sha256:7912bfacf96f145affdad3377d850cc81c802552d145dfc307e3f619abe22d0c`.
Финальный web image: `sha256:17e09c70032a09d837bfd4bc499210f123bd0986b47f07215d93e8407f638b75`.
Образы перенесены через save/load и закреплены в приватном `images.env`.
CI проверяется отдельно по SHA после публикации; исторический baseline CI
не считается подтверждением этого изменения.

Подробные локальные логи, JSON-проверки, source hashes и скриншоты:
`output/market-yc-preparation-20261106` и `output/playwright/market-limited`.
Учётные данные хранятся отдельно и в evidence не включены.

Саморегистрация/сброс пароля через email, внешние отправки, платежи, OAuth,
подписание и внешняя AI-модель недоступны. Допуски поставщика и договоры
автоматически не подтверждаются. Backup находится на той же ВМ;
внешнее автоматическое резервирование и обновление AV-сигнатур не настроены.
Реальные клиентские/медицинские данные для этого стенда не принимаются.
