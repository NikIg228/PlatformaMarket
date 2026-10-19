# Проверка личности по CMS НУЦ

`NcaIdentityVerifier.java` — независимая серверная проверка одного detached CMS.
Процесс не получает закрытых ключей и не подписывает. API сохраняет оригинал и CMS,
worker запускает verifier вне транзакции, затем повторно проверяет доступ и lease.
Подтверждение личности не выдаёт полномочия организации и не подписывает накладную.

## Развёртывание

Используется Java runtime и Kalkan/KNCA provider utils из разрешённого SDK НУЦ.
В проверенном тестовом окружении: Java8, kalkancrypt0.7.8, knca_provider_util0.8.5,
slf4j-api/simple1.7.36. SDK и JAR не включаются в Git. Сборка класса:

```powershell
& "$env:NCA_JAVA_HOME/bin/javac.exe" -encoding UTF-8 -cp "$env:NCA_DEPENDENCIES/*" -d '<classes>' scripts/nca-verifier/NcaIdentityVerifier.java
```

Для API и worker задаются одинаковые четыре значения:

- `NCA_IDENTITY_JAVA_PATH`: абсолютный путь к Java executable.
- `NCA_IDENTITY_CLASSPATH`: каталог с собранным классом и разрешённые JAR,
  разделитель `;` в Windows или `:` в Linux.
- `NCA_IDENTITY_POLICY_PATH`: абсолютный путь к deployment-owned `.properties`.
- `NCA_IDENTITY_POLICY_SHA256`: SHA-256 точных байтов файла policy, lowercase hex.

При неполной настройке создание challenge недоступно. При неверном hash, ошибке
запуска или неоднозначном ответе привязка не создаётся; сохранённая CMS остаётся
в UNKNOWN для повторной проверки. Worker должен работать с `PROCESS_ROLE=worker`
(локально допускается `all`); API-процесс не запускает планировщик.

Policy содержит `profile=PRODUCTION` и для каждого из `signer.root`,
`signer.issuer`, `tsa.root`, `tsa.issuer` два ключа `.file` и `.sha256`.
Файлы сертификатов располагаются относительно policy; digest считается по DER.
Дополнительно обязательны URL `signer.leaf.crl`, `signer.issuer.crl`,
`tsa.leaf.crl`, `tsa.issuer.crl`. Сертификаты/URL и их происхождение проверяются
при отдельной настройке production trust; нельзя переносить тестовую policy.
Класс и JAR, policy и certificates должны быть доступны процессу только на чтение.
Путь AIA из пользовательского сертификата не используется для сетевого запроса.

Verifier проверяет единственного подписанта, точные байты оригинала, подпись CMS,
цепочки до pinned trust anchor, KU/EKU, срок действия, обязательную RFC3161-метку
и её imprint/подпись, четыре актуальных CRL и статус отзыва. TEST policy запрещена
при `NODE_ENV=production`. Ошибки конфигурации не означают недействительную ЭЦП.
Все доказательства доверия возвращаются в защищённой receipt; сертификаты,
полный ИИН, CMS и содержимое receipt не возвращаются в браузер или журнал.

## Хранение и восстановление

Challenge действует10мин. Своевременно принятая CMS может проверяться после
истечения challenge. Автоматическая обработка ограничена8 попытками, двумя
процессами на worker и45с на процесс; lease90с восстанавливает прерванные задания.
После исчерпания попыток пользователь повторяет проверку сохранённой CMS.
Повторного подписания для этой операции нет. Отмена, отзыв входа или membership
до фиксации запрещают привязку; поздний валидный результат сохраняется как evidence.
Конкурентные привязки одного ИИН исключаются частичными unique indexes в PostgreSQL.

`APP_SECURITY_ENCRYPTION_KEY` защищает CMS, receipt и ИИН AES-256-GCM и используется
для purpose-separated HMAC fingerprint ИИН. Ключ одинаков у API и workers.
Его нельзя просто заменить при наличии привязок: нужна отдельно подготовленная
атомарная миграция шифротекста **и всех fingerprints**, с сохранением уникальности,
временной остановкой записей и проверенным backup/restore. Онлайн-ротация в этом
пакете не реализована. Полный ИИН не является ключом поиска в открытом виде.

## Проверки

Все DB-команды ниже используют только disposable test DB через штатный wrapper.
Перед HTTP-проверкой собрать schemas/API; рабочую БД не мигрировать этим runbook.

```powershell
npm run db:test -- exec -- prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run db:test -- exec -- tsx --tsconfig apps/api/tsconfig.json scripts/verify-identity-signing.mjs
npm run db:test -- exec -- tsx --tsconfig apps/api/tsconfig.json scripts/verify-identity-signing-worker.mjs
npm run db:test -- exec --call "node scripts/verify-identity-signing-http.mjs"
node scripts/verify-identity-signing-ui.mjs
```

Для HTTP и `node scripts/verify-nca-identity.mjs` требуются `NCA_SDK_ROOT`,
`NCA_JAVA_HOME`, `NCA_DEPENDENCIES` и доступ к тестовым TSP/CRL НУЦ.
`NcaIdentityFixtures.java` использует только публичные тестовые ключи SDK,
проверяет их issuer и pinned архив тестовых CA. Пароль читается из README SDK,
не выводится в отчёт. HTTP-тест проверяет настоящий CMS/Java/БД через JWT API.
Worker-тест использует синтетическую receipt только для проверки транзакций.

UI-проверка требует уже запущенный canonical frontend на127.0.0.1:3000
(можно задать `IDENTITY_UI_BASE_URL` с loopback origin). API и WebSocket заменены
браузерными fixtures: это проверка интерфейса, не evidence native NCALayer.
Скриншоты/computed styles сохраняются в `.tmp/nca-identity/ui`.
`--states-only` запускает только дополнительные состояния и пишет отдельный отчёт.
Тестовые ключи, CMS, сертификаты и receipt из `.tmp` не публикуются.

Production trust, native пользовательская ЭЦП и mobile signing принимаются отдельно.
