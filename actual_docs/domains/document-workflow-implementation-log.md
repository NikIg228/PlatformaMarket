# Документооборот — выполненные этапы и технические решения

Обновлено 19.10.2026. Журнал реализации полного документального процесса сделки.
Требования — [Workflow документооборота](MARKET_DOCUMENT_WORKFLOW.md), единственный
checklist — [R7.6 основного roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#document-workflow).

## 19.10 — R7.6.3.1: реальный прототип, SCOPED PASS / этап PARTIAL

**Актуализация22:03 — negative evidence PASS на Windows/Linux.** Поручение
владельца: продолжить R7.6.3.1. База6584fd5/main, canonical checkout, чужой WIP
сохранён. План: закрыть actual expiry и unavailable revocation; риск ложного
GOOD при ошибке сети/парсинга. Gates: compile + новый focused mode на двух ОС,
регрессия общих CRL/реальных CMS/TSP, node syntax и diff hygiene. Budget: Java60с,
до3 попыток; API/БД/UI не меняются. Применены development-toolkit и Reality Checker
для сопоставления утверждений с реальными crypto evidence, без общего E2E.

Новый `negative-evidence`: **6 PASS** Windows17:02:34 UTC и Linux17:02:58 UTC.
Сертификат руководителя из SDK2024–2025 истёк29.10.2025; проверяется текущая дата,
а не injected clock. Kalkan создаёт CMS этим тестовым ключом, но `verifyCMS`
отклоняет её с причиной CertificateExpiredException. HTTP503 CRL/OCSP и
повреждённые HTTP200 ответы воспроизводятся только loopback-сервером; реальные
SDK parsers не дают успеха. CRL parser может вернуть null — добавлен явный отказ.
Это не внешний outage и не сертификат production retry/fallback/timeout/UNKNOWN.

Попытка1:2 PASS/4 FAIL (ошибочные ожидания типов исключений и места expiry отказа).
Попытка2:5 PASS/1 FAIL (createCAdES не проверяет expiry). Попытка3:6 PASS после
изоляции verifyCMS и проверки цепочки причины. Linux:6 PASS с первой попытки.
Manifests: `.tmp/nca-prototype/negative-evidence-2026-10-19T17-02-34-158Z.json`
и `linux/negative-evidence-2026-10-19T17-02-58-318Z.json` в том же каталоге.
Регрессия Windows revocation17:02:21 —3 PASS, browser17:02:35 —4 PASS;
Linux timestamp17:03:03 —9 PASS, exit0. SDK/dependencies прежние, новые hashes
source/expired certificate/CMS записаны в manifest. Приватные ключи не публикуются.

Desktop prototype SCOPED PASS. Общий этап PARTIAL: доступ/контракт eGov QR и
реальная mobile подпись отсутствуют. Следующий внешний вход — актуальный паспорт
и тестовый доступ мобильного сервиса с подтверждением подписи от имени ЮЛ.
Рабочие adapter/полномочия/UI требуют R7.6.1.2–3; этот прогон их не реализует.
Прежние ограничения unavailable/actual expiry ниже закрыты этим evidence.

**Актуализация21:57 — issuer revocation blocker снят.** По поручению владельца
найден официальный каталог КУЦ `https://crl.root.gov.kz/`, публикующий тестовый
RSA2020 CRL `https://crl.root.gov.kz/test_rsa2020.crl`. В test profile прописан
явный override сломанного CDP; доверие не ослаблено: подпись проверяется SDK root,
issuer и freshness обязательны. CRL действует02.10.2026 05:05:43Z–06.11.2026
05:05:43Z; intermediate не отозван, stale CRL отвергается.
Третья попытка issuer-revocation gate обоснована новым официальным источником.

`verify-timestamp-evidence` на Windows16:56:09 и Linux16:56:26 UTC — **9 PASS**
на каждой ОС, exit0; manifests в `.tmp/nca-prototype[/linux]/`. Проверены исходный
CMS, timestamp signature/imprint, wrong imprint, EKU/validity, SDK цепочка,
доверенная цепочка, TSA OCSP, CA CRL/freshness и повреждённый штамп (часть checks
сгруппирована). SHA/URL/nextUpdate сохранены в manifest/evidence. Неизменённые
offline/browser/обычные revocation и client checks переиспользованы по области.
Текущий blocker закрыт; полный R7.6.3.1 остаётся PARTIAL из-за остальных границ
приёмки, включая unavailable-revocation fixture и ограничения validity cases.
Рабочий verifier/полномочия/документы/UI и mobile этим прототипом не реализованы.
История FAIL/BLOCKED ниже относится к предыдущим входам и не текущему TSP gate.

**Актуализация21:54 — RSA trust найден, issuer revocation BLOCKED.** Поручение
продолжить сравнение сертификатов; план: проверить локальный SDK/официальный
портал, установить provenance, test-only trust по hash, targeted TSP и отзыв,
регрессия общей CRL-функции, diff hygiene. Новый SDK в Downloads не появился.
Портал повторного получения требует email; запрос не отправлялся, поскольку
дополнительная инвентаризация вложенных архивов решила вопрос provenance.

Исправление прежнего вывода: корень отсутствует в Java store/основной CA-папке,
но **есть в полученном официальном SDK**, в
`C/Linux/ca-certs/ca-certs_old/test.zip` вместе с нужным RSA issuer.
Архив SHA256622b758f00d957a215dcfb895a549b86d3adcadf08cc5e548fb49a20323c77b9;
root DER совпал с HTTP candidate, issuer также соответствует цепочке TSA.
Harness читает и проверяет hashes архивных cert entries, использует только
явное тестовое доверие; настройки ОС/NCALayer не менялись.

Сохранённый реальный timestamp: manifest16:51:45 UTC —7 PASS, включая
trusted-chain и OCSP TSA GOOD. Расширенный gate16:52:24 —8 PASS/1 FAIL:
добавлен PASS повреждённого штампа, но CRL из issuer certificate
`http://test.pki.gov.kz/crl/root_rsa_test.crl` возвращает404. Каталог `/crl/`
доступен и этого файла не содержит; отдельный OCSP запрос для intermediate
получил status1 (не GOOD). Две попытки нового issuer-revocation блокера:
CRL и диагностический OCSP; дальнейшие повторы остановлены без новой гипотезы.
Следующий точный вход — свежий root-signed CRL для RSA intermediate либо
работающий OCSP этого intermediate. Trust blocker снят; полный TSP результат
INDETERMINATE по отзыву CA, не INVALID и не VERIFIED.

Общая CRL-функция обобщена на явный issuer; прежний GOST revocation gate
16:53:38 —3 PASS. `node --check`/diff hygiene PASS. Evidence в
`.tmp/nca-prototype`, точные manifests/хеши в README. Полная приёмка и публикация
пакета остаются заблокированы; нет новых app/API/DB изменений или обращений в НУЦ.

**Актуализация21:48 — Linux runtime SCOPED PASS.** После перезагрузки владельцем
обнаружен WSL3.0.1 без distro; `wsl --install -d Ubuntu --no-launch` завершился
exit0. Фактическое окружение Ubuntu26.04.1, x86_64, kernel
6.18.40.1-microsoft-standard-WSL2. Portable Linux Node24.18.0 и Temurin8u504
получены с nodejs.org/Adoptium, SHA256 проверены; глобальные Node/Java не менялись.
Исходники исполнялись из канонического checkout через /mnt/c, без клона/копии.
План завершения: offline/browser + отдельный CRL/OCSP gate, сверка hashes,
manifest/evidence, docs и diff hygiene; known TSP trusted-chain не повторять.

`bash scripts/nca-prototype/run-linux.sh` — **18 PASS**, первая попытка каждого
Linux gate: offline11, verify-browser4 (две реальные NCALayer CMS), revocation3
(CRL good/revoked/stale и OCSP good/revoked). Каждая команда exit0. Сводка:
`.tmp/nca-prototype/linux/summary.json`; manifests offline16:47:48,
verify-browser16:47:54, revocation16:47:57 UTC. SDK/SLF4J hashes, исходные байты,
test signer и оба receipts совпадают с Windows evidence. Runner дополнен
architecture/kernel/Node metadata и отдельным режимом revocation (та же логика
CRL/OCSP без TSP); Linux outputs изолированы. Node/Bash syntax и diff hygiene PASS.

Linux-блокер standalone прототипа снят. Запуск под root в новой WSL distro не
сертифицирует production service account/deployment. TSP trust provenance,
TSA revocation и оставшаяся приёмка полного прототипа остаются открыты;
обновлённый SDK владелец получает отдельно. Полный R7.6.3.1 не ACCEPTED,
commit/push полного пакета не выполнены из-за известного trusted-chain FAIL.
Далее сохранена история подготовки: записи Linux NOT_RUN ниже относятся к
предыдущим запускам и заменены результатом21:48.

WSL setup, уточнение21:25: по явному разрешению владельца агент запустил
`wsl --install -d Ubuntu --no-launch` через elevated PowerShell (OS RunAs).
CBS journal подтверждает21:17:39 успешную установку VirtualMachinePlatform,
HRESULT0/S_OK, `Reboot required: yes`. Диагностика сохранена в
`.tmp/nca-prototype/wsl-diagnostic.txt`. Полная установка WSL/Ubuntu ещё не
подтверждена: wrapper/wsl остаются запущены без итогового exit/result, Linux
NOT_RUN. Следующий шаг — сохранение работы и перезагрузка Windows владельцем,
затем проверка установленного WSL/distro до любых повторных install-команд.
Автоперезагрузка и принудительное завершение Windows servicing не выполнялись.

Linux follow-up по поручению владельца: preflight на main/9f2418b подтвердил
отсутствие установленного WSL/distro, Docker/Podman и admin token. План:
изолировать Linux artifacts от Windows evidence, подготовить запуск из того же
канонического checkout через /mnt/c, проверить синтаксис/отказ на non-Linux,
после host setup выполнить offline + browser crypto gates. Добавлен
`scripts/nca-prototype/run-linux.sh`; runner сохраняет Linux outputs в отдельной
`.tmp/nca-prototype/linux`. Node syntax и Bash syntax PASS; non-Linux guard
отказывает exit1 как ожидается. Реальный Linux NOT_RUN: требуется установка WSL
из Administrator PowerShell владельцем, затем Linux Node/JDK8. Установка и
перезагрузка не выполнялись; инструкция в README. Windows crypto gates не
повторялись: их входы не изменились. Обновлённый SDK владелец получает отдельно.

Продолжение по поручению владельца после ручного подписания, база main/9f2418b:
проверить реальные receipts, проанализировать и устранить блокеры. План: Kalkan
verify исходного/изменённого документа, диагностика RSA trust без автоматического
доверия AIA, исправление подтверждённого response parsing с regression/types/lint
и проверкой зависимого signing helper. Несвязанный WIP сохранён.

Два NCALayer receipts 16:01:10/16:01:34 UTC: **4 PASS** — обе detached CMS
проверены на исходных байтах, ожидаемом test signer, chain, роли руководителя и
БИН; изменение байта отвергнуто. Manifest:
`.tmp/nca-prototype/verify-browser-2026-10-19T16-03-21-530Z.json`.
Реальный ответ `body.result: [PEM]` выявил дефект `packages/eds-client`:
добавлен разбор одного CMS, нормализация PEM→base64, отказ malformed/multiple.
Legacy response сохранён. `npm run test --workspace=@marketplace/eds-client`
9 PASS; typecheck/lint того же workspace PASS; targeted supplier
`app/marketplace-agreement-signing.test.ts` 3 PASS. `npm audit --omit=dev
--audit-level=high` — high/critical0, moderate9 (не изменение зависимостей).

TSP: новый разрешённый цикл, попытка1 диагностического gate на сохранённом CMS:
5 PASS (original/signature/imprint/negative imprint/EKU/date/candidate signatures
сгруппированы в пять checks), trusted-chain FAIL. Manifest
`.tmp/nca-prototype/verify-timestamp-evidence-2026-10-19T16-05-28-625Z.json`.
Корень RSA TEST2020 доступен по HTTP `/cert/`; AIA `/crl/` даёт404, HTTPS root и
issuer завершились timeout20с. SDK0.8.5 и installed NCALayer utils0.9.2 содержат
старые RSA test roots с другими ключами. HTTP candidate криптографически
связывает TSA и issuer, но **не добавлен в доверенные**. Статус INDETERMINATE;
нужен аутентифицированный SDK update либо подтверждение fingerprint от НУЦ.
SHA256 и вопрос поддержке записаны в README; сообщение не отправлялось.
Cancellation: первая попытка16:06:32 вернула CMS (не PASS отмены); повторное
ручное действие владельца16:07:40 вернуло `status:true, body:{}` без CMS.
Факт отмены зафиксирован отдельно; клиент не принимает этот envelope как успех.
Добавлен regression: итоговый client suite10 PASS, types/lint PASS. Сообщение
локальной тестовой страницы учитывает наличие CMS, а не один status.
Linux NOT_RUN; desktop CMS и ручная отмена подтверждены,
полный R7.6.3.1 не ACCEPTED. Commit/push не выполнены: trusted-chain gate FAIL.

Ниже — исходный запуск и история ограничений (состояние NCALayer обновлено выше).

Поручение владельца «приступай» после актуализации спецификации. База main/16aac34.
Scope: отдельный synthetic-прототип SDK/NCALayer, без включения подписания рабочих
документов, изменения доменных API/БД и рабочего профиля NCALayer. Применяется
development-toolkit backend/verification. Риски: ложный crypto PASS, смешение
test/production trust, потеря оригинала, неограниченные внешние вызовы.
План проверок: компиляция standalone Java harness; реальные CMS и негативные
случаи integrity/certificate/trust/revocation/TSP с manifest; NCALayer отдельно
от прямого SDK signing, Linux отдельно от Windows; bounded network timeouts,
максимум3 обоснованные попытки на gate. Итог: evidence/ограничения в журнале и
roadmap, diff hygiene. Общие app build/DB suites не нужны для standalone harness.
Preflight: системный javac/Docker и готовый WSL отсутствуют; рабочий NCALayer
содержит JRE8u422. Изолированный portable JDK8u504 получен с официального Adoptium,
SHA256 проверен, лежит в ignored .tmp/nca-prototype; системные настройки не менялись.

Создан [standalone harness и инструкция](../../scripts/nca-prototype/README.md).
На Windows/JDK8u504: offline-3 — 11 PASS (CMS, integrity, chain, validity,
EKU/BIN, отсутствие обязательного TSP); online-3 — CRL и два OCSP случая PASS,
TSP FAIL `ISSUER_CERT_NOT_FOUND`. Тестовый TSA использует RSA TEST; цепочка с
bundled test trust store не построена. Лимит3 попыток online исчерпан; повтор
остановлен. Следующий точный шаг: подтвердить актуальную официальную RSA test
цепочку доверия и открыть новый ограниченный цикл проверки. Корень из AIA
автоматически доверенным не становится. Проверка отзыва TSA ещё не реализована.

Диагностическая команда `node scripts/nca-prototype/run.mjs inspect-timestamp`
PASS (компиляция/runner, без повторения crypto gates); manifest
`.tmp/nca-prototype/inspect-timestamp-2026-10-19T10-11-28-514Z.json` содержит
runtime, source/dependency/evidence SHA256. Логи offline-3/online-3 сохранены
локально; manifest диагностики не является повторным выполнением этих тестов.
`node --check` для обоих mjs и `git diff --check` PASS.

NCALayer: подготовлена localhost4079 страница, запрос ограничен тестовым
сертификатом руководителя 2026–2027 и явной test chain; CMS без TSP, результат
сохраняется отдельно. Ожидается действие владельца в нативном окне (инструмент
управления нативными окнами недоступен). Подписание/отмена через NCALayer,
независимая проверка полученного CMS и Linux runtime пока NOT_RUN.
Прямое SDK signing не заменяет NCALayer evidence. Product API/UI/БД не менялись;
этап не ACCEPTED, checkbox открыт, переход к .3.2/.3.3 не выполнен.

## 19.10 — R7.6.3: SDK получен, спецификация и порядок актуализированы

Поручение владельца: проверить достаточность технических описаний и дополнить
существующий этап ЭЦП перед последующим началом реализации. База main/cefdac4;
изменяются только спецификация, раздел roadmap и этот журнал. Несвязанный WIP
сохранён. План проверки docs-only: сверка с SDK/кодом и зависимостями DWF,
локальные ссылки/anchors, отсутствие секретов, diff hygiene; без app/DB/browser gates.

Официальный SDK получен владельцем в Downloads/SDK. Статически изучены README,
changelog, Java/C/COM/PHP состав, документация проверки и тестовые сертификаты/
сервисы. [EDS §10](EDS_IMPLEMENTATION_SPEC.md#10-полученный-sdk-и-мобильное-подключение)
содержит версии, ограничения документации и требования изоляции. Отсутствие SDK
больше не внешний блокер; исполнение библиотек и реальная подпись остаются NOT_RUN.

Существующая спецификация дополнена, новый конкурирующий backlog не создан.
Закреплён порядок: .3.1 реальный synthetic desktop-прототип → относящиеся к подписи
.1.2–3 формы/полномочия/контракт → .3.2 verifier/commit → .3.3 UI → .4.2–3 подписи
накладной обеих сторон. Добавлены manifest прототипа, negative cases, trusted original
для verifier, результаты INVALID/INDETERMINATE, runtime selection, evidence/gates
по пакетам и отдельный статус mobile. Кандидат Java — предложение для прототипа,
не утверждение уже установленного runtime или production готовности.

Подтверждено кодом: клиент NCALayer существует, вызовов из приложений не найдено;
gateway verifier не реализован, запрос не содержит original bytes; preview накладной
и довоза не допускает подписи. Формы/полномочия по §13 DWF остаются открытыми.
Обновление не снимает эти guards, не принимает формы, не меняет продуктовый код,
рабочую БД, NCALayer или внешние сервисы. Следующее действие после поручения —
R7.6.3.1 по [EDS §11.1](EDS_IMPLEMENTATION_SPEC.md#111-исполнимый-пакет-прототипа-r7631).

Проверки документации: все локальные file links трёх изменённых документов
разрешаются; новые anchors сверены с заголовками; `git diff --check` PASS.
Применён development-toolkit для сверки реализации/границ и профильные практики
backend architecture: доверенный оригинал, отдельный verifier, атомарная фиксация.
App/build/DB/browser/SDK execution не запускались — продуктовый код не изменён.

<a id="production-templates-20261016"></a>
## 16.10 — R7.6.1/2/4/5: подготовка боевых форм

Явная передача поручения владельца в задачу «Шаблоны документов» после
4ebae7b разрешает реализацию форм. Утверждённых бухгалтером/юристом образцов
пока нет; подготовка образцов не означает их принятия или завершения R7.6.
Canonical root/main/4ebae7b сверены; существующий несвязанный WIP сохранён.

План до изменений: сопоставить семь форм с первичными источниками и существующими
snapshots; подготовить конкретный комплект для содержательной приёмки; затем
менять согласованные контракты, renderer и необходимый UI связанными пакетами.
Риски: неверная применимость формы, вымышленные полномочия, потеря оригинала,
подмена количеств партии итогом заказа, повторные финансовые/складские эффекты.
Образцы используют только вымышленные данные и явную отметку отсутствия подписей.
Для матрицы/образцов: источники и ссылки, сверка арифметики, PDF text и визуальная
проверка страниц, diff hygiene. Для runtime-пакета до кода уточнить schema/client
tests, focused backend tests, types/build и применимые PG/contract/UI gates по
фактически изменённому поведению. Рабочая БД и dev-процессы не изменяются.
Приёмка формы бухгалтером/юристом и реальный путь подписи остаются отдельными
открытыми условиями выпуска; их нельзя заменить техническим PASS.

Подготовлен [PDF-комплект для приёмки](../../output/pdf/document-templates-review/document-templates-review.pdf)
и [воспроизводимый генератор образцов](../../output/pdf/document-templates-review/build_samples.py).
Восемь образцов на девяти страницах: счёт, исходная партия, довоз, урегулирование,
исправление, возврат, одностороннее заявление и проект совместного акта.
Последние два показаны отдельно, а не объявлены двумя обязательными формами.
Даты16–19.10 и количества10/8/2 согласованы; возврат показан отдельным примером.
Все данные вымышленные; отсутствующие банковские сведения/подписи/полномочия
не имитируются. Комплект создан вне runtime renderer и не является его evidence.

Проверки: `build_samples.py` — PASS; `pdfinfo` —9 страниц A4 landscape;
`pdftoppm -r 65 -png` — PASS, просмотрены все9 страниц, после исправления дат
повторно страницы4/6/7. pdfplumber: границы символов, отметки отсутствия подписей,
число страниц/контрольные даты/суммы — PASS. `git diff --check` — PASS.
Нет evidence многостраничной формы с длинным перечнем, НДС-сценариев или
совпадения нового runtime-PDF со snapshot: это ещё не реализовано и не проверено.
TS/build/DB/browser не запускались: изменены спецификация и отдельный комплект,
приложение/контракты/данные/процессы не изменены.

Владелец ответил: контакт проверяющего определим позже. Зависимая окончательная
форма/выпуск остаются открыты. Техническая сверка показала: для довоза V1 нет
полного снимка реквизитов и стоимости; источник заявления уже хранит unitPriceMinor
и taxSnapshot. Для расширения нужны версияV2 с чтениемV1, отдельная проверка
подтверждённых реквизитов/их блокировок и regression старых документов; простая
подстановка текущих реквизитов при скачивании недопустима. Код не изменён.
Следующий пакет: согласовать точную форму по образцам и полному приложению З-2,
затем versioned snapshot/API/UI с указанными в плане целевыми проверками.
Подготовка комплекта завершена, реализация боевых форм и весь R7.6 НЕ завершены.

<a id="resupply-working-documents"></a>
## 16.10 — R7.6.5.2: рабочие документы довоза — SCOPED PASS

Владелец согласовал §8.2 и поручил реализацию; отдельно подтвердил отсутствие
утверждённых форм. Граница: два явно неутверждённых PDF-черновика (допоставка и
урегулирование), сохраняемые версии и просмотр/скачивание обеими сторонами.
Итоговый черновик доступен после полного получения довоза. Выпуск, подписи и
RESOLVED недоступны до утверждения форм/полномочий и НУЦ; это не полная R7.6.5.
База main/ee33e35; чужой catalog/CI/docs WIP сохраняется.
План: общие schema/API → сервис подготовки с tenant/permission/version/replay,
неизменяемыми snapshots и PDF → focused backend tests до UI → client и общий
блок в существующем диалоге расхождения обеих сторон → целевые проверки.
Риски: чужой claim/document, подмена оригинала, преждевременный итог, повторная
генерация/списание, обход запрета подписи через общий Documents API.
Gates: schema/client tests/build; API focused tests/types/build; изолированный
PostgreSQL с happy/invalid/tenant/replay/concurrency/rollback и неизменностью
оригинала/денег/stock; core-contract/runtime split; frontend types/build,
targeted browser supplier/buyer 1440/390, keyboard/recovery, screenshot/computed;
PDF inspection, scoped lint и diff hygiene. Prisma schema не меняется, если
существующий Document покрывает хранение; рабочая БД не изменяется.
UI-паспорт: аналог packages/ui/src/order-resupply-panel.tsx и диалог
order-discrepancy-panel.tsx; DmButton/DmFeedback/DmTable/DmFormSections, Manrope14,
controls44/radius8, dialog16, market-components-v1/platforma-semantic-light-v1.
Новые shared параметры/локальные control overrides не вводятся.

Реализованы общие schema/client/OpenAPI и три endpoints, сервис PDF на существующем
Document (OTHER/DRAFT), сохранение snapshot/версий/контрольной суммы, supplier-only
подготовка с document.issue и двустороннее чтение с document.view. Обычные endpoints
подписи и новой версии блокируют эти черновики. Транзакция заказа включает audit/
outbox, файл незавершённой транзакции удаляется после проверки отсутствия записи.
Никаких миграций/рабочих данных/НУЦ не изменено.

Проверки на этой реализации:

- `npm run build --workspace @marketplace/schemas`, schema resupply-document1 PASS;
  `npm run build --workspace @marketplace/api-client`, client resupply-document1 PASS.
- `npm run test --workspace @marketplace/api -- src/modules/documents/resupply-document.service.spec.ts src/modules/documents/resupply-document.rules.spec.ts src/modules/documents/documents.service.spec.ts`
  —22 PASS; API typecheck PASS; `npm exec --workspace @marketplace/api -- nest build`
  PASS. Prisma client/schema не менялись, повторная генерация не нужна.
- `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --resupply-only`:
  попытка1 — API не готов за60с, FAIL до бизнес-проверок (documents-postgres-1.log).
  Попытка2 после завершения конкурирующих сборок — PASS/exit0, cleanup PASS
  (documents-postgres-2.log). Проверены права/tenant, invalid/stale, преждевременный
  итог, outbox rollback, concurrent replay, PDF/checksum, сохранённые версии,
  чтение клиники и неизменность денег/stock/AGREED; исходный довоз10/8/2 также PASS.
- `npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only`
  PASS:366 operations/254 schemas, response/error validation; runtime-split PASS.
- Unified web build через существующий изолированный NEXT_ADAPTER_PATH PASS49 routes;
  повтор после исправления keyboard focus также PASS. E2E TypeScript PASS.
  `npm run typecheck --workspace @marketplace/ui` PASS.
- `npm exec -- playwright test --config .tmp/resupply-flow/ui.config.ts --workers=1 --grep 'working resupply documents'`:
  попытка1 — оба сценария дошли до скачивания, но Escape после потери фокуса не
  закрыл диалог. Возврат фокуса на trigger после download исправлен в компоненте.
  Попытка2 —2/2 PASS (1440/390, обе роли, empty/error/replay/conflict/download/
  keyboard, отсутствие overflow). Четыре финальных screenshot просмотрены;
  computed Manrope14/radius8 и shared controls проверены.
- PDF двух видов сформированы продуктовым renderer, преобразованы pdftoppm и
  просмотрены: читаемость/маркировка/отсутствие обрезки PASS. Применён PDF skill для
  визуальной проверки; development-toolkit — для backend/контрактов и UI.
- Scoped ESLint PASS, повтор изменённого UI/test/fixture PASS. Логи и snapshots:
  `.tmp/resupply-flow/documents-*`, `preview-*`, `ui-results/**/working-documents*`.
  Diff hygiene и локальные ссылки PASS. Во время работы появился независимый
  docs-only commit fb087be; затронутые runtime inputs не изменены, PASS сохранён.

Полная R7.6.5 и юридический выпуск не приняты: отсутствуют утверждённые формы,
основания полномочий и рабочий НУЦ. Full release/E2E вне выбранной границы.

## 16.10 — R7.6.5.1: предложение документального закрытия довоза

По поручению владельца подготовлено [предложение §8.2](MARKET_DOCUMENT_WORKFLOW.md#resupply-document-proposal)
на базе main/00af0cc. Scope docs-only: состав связанных документов, действия и
подписи сторон, неизменность оригиналов, условия RESOLVED и отдельная полнота заказа.
Риск — выдать предложенный процесс за утверждённую форму или действующий код;
поэтому PROPOSED и зависимость форм/полномочий/НУЦ обозначены явно.
Сверены действующие §8/8.1, roadmap, order-discrepancy schema и order-resupply.
Применён development-toolkit для проверки границ контракта и повторного использования.
Проверки: локальные ссылки, согласованность 10/8/2 и запрета нового счёта,
diff hygiene. Runtime не менялся; builds/DB/browser не требуются.
Открытое решение: подтвердить предложенный процесс и получить утверждённые формы
и основания полномочий. Реализация и весь R7.6.5 остаются открытыми.

## 16.10 — R7.6.5.1–3: операционный довоз — SCOPED PASS

База `main@3aa1c0b` + локальный scope довоза; Admin опубликован отдельно.
Сценарий: по согласованной недостаче 10/8 поставщик регистрирует отправку 2,
клиника подтверждает получение связанной допоставки. Исходные 10/8, накладная,
сумма продажи и оплаченный резерв сохраняются; дополнительные 2 списываются
отдельно. AGREED не означает RESOLVED, документальный комплект остаётся INCOMPLETE.
Schema/API/Prisma и UI обеих сторон прошли scoped приёмку операционного довоза.
Полный R7.6.5 не принят: формы/подписи/возвраты и другие исключения остаются открыты.

План приёмки: focused service tests, migration upgrade и изолированный PostgreSQL
10/8/2 с tenant/role/stale/stock/rollback/concurrent replay; types/build/lint,
целевой browser desktop1440/mobile390, keyboard/recovery и screenshot/computed styles.
Новые общие UI-параметры не вводились: shared adapters, Manrope14, controls44/8,
market-components-v1/platforma-semantic-light-v1. Полная приёмка R7.6.5 открыта.

Подтверждено 16.10: API build в штатном запуске dev; focused Vitest
order-resupply7 + order-workflow10 + order-fulfillment-state4 = 21 PASS;
supplier typecheck и E2E TypeScript PASS; scoped ESLint PASS.
Изолированный unified production build (49 routes) PASS, повтор после правки
validation формы также PASS. Scoped lint изменённой формы повторно PASS.
Browser: attempt1 не нашёл tests из-за относительного testDir во временном config;
attempt2 — 4 PASS/2 FAIL: native required validation скрывала русскую inline ошибку.
Форма получила noValidate с сохранением собственной проверки tracking/acknowledged.
Attempt3 — только два affected resupply сценария, 2/2 PASS; четыре неизменённых
сценария переиспользованы. Команда `npm exec -- playwright test --config
.tmp/resupply-flow/ui.config.ts --workers=1 --grep 'agreed resupply'`.
Проверены dispatch unknown-result/retry с тем же payload, замороженные8,
переход/фокус к допоставке, получение2 и документальная неполнота на mock API.
Логи browser-attempt2/3.log; четыре screenshots confirm/received1440/390
из `.tmp/resupply-flow/ui-results` просмотрены, computed44/8/Manrope и overflow PASS.
Browser mocks не заменяют незавершённую PostgreSQL-проверку.

PostgreSQL попытки сохранены, лимит не сбрасывается:

1. `.tmp/resupply-flow/run-pg.mjs`: прежний запуск без итогового receipt — INCOMPLETE,
   лог сохранён как `postgres-attempt1-incomplete.log`.
2. Тот же изолированный loader: миграции/seed PASS, тестовый API не готов за60с;
   `postgres.log` — FAIL до бизнес-проверки.
3. `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --resupply-only`:
   штатная свежая сборка API/Prisma, DB `dentmarket_audit_20260914`; запуск API и
   additive upgrade прошли, fixture накладной отклонён `Document_file_metadata_check`.
   В `scripts/lib/verify-order-resupply.mjs` у synthetic document задан checksum,
   но отсутствует storageKey. Лог `postgres-attempt3.log`, итог FAIL/BLOCKED.

После отдельного разрешения владельца выполнен новый цикл с изменённым планом:
synthetic PDF создан через PDFKit в изолированном storageRoot; storageKey,
fileName/contentType/byteSize и SHA256 соответствуют реальному файлу. Добавлена
проверка сохранности его checksum после довоза; ограничения БД не менялись.

- `postgres-authorized-1.log`: документ создан, но cleanup нарушал FK, удаляя
  shipment раньше заявления, и скрывал исходный assertion. Порядок cleanup исправлен,
  исходная ошибка теперь сохраняется отдельно. Остатки именно этого запуска
  b04_1792133351164_16668 удалены из audit DB с проверкой identity и штатной cleanup
  функцией; итог cleanup PASS, рабочая marketplace не затронута.
- `postgres-authorized-2.log`: cross-order assertion использовал покупателя и
  ожидал404, но role denial закономерно вернул403. Fixture исправлена: отдельно
  проверяются чужой supplier tenant и законный supplier другого заказа с чужим claim.
- `postgres-authorized-3.log`: tenant/role/invalid/stale/insufficient-stock checks
  прошли; ожидание409 для «только просроченная партия» получило201. Базовая функция
  createFixtureCatalog создаёт пригодный ACTIVE lot со сроком2035-12-31, который
  resupply fixture не исключила. Отказ без пригодного lot этим запуском не проверен;
  это дефект состава fixture, не доказательство списания просроченного товара.

Этот цикл исчерпал три попытки и был остановлен. После следующего явного
разрешения владельца базовые lots только собственного тестового balance помечены
BLOCKED, добавлено явное предусловие «нет пригодных lots», затем отдельный пригодный
lot для happy path. Новый запуск1 PASS: `postgres-lots-1.log`, exit0, cleanup без ошибок.
Команда `npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --resupply-only`.
Доказаны upgrade, 10/8/2, tenant/party/foreign-claim, invalid/stale, недостаточный
остаток/просроченная партия, rollback outbox, concurrent replay, точное отдельное
списание2 с lot trace, запрет поздних10/overreceipt/приёмки поставщиком/нового счёта,
DELIVERED товара при AGREED/INCOMPLETE документов и неизменность original PDF.

Завершающие gates на неизменном runtime: `npm run db:test -- exec -- node
scripts/verify-pilot-backend.mjs --contract-only` PASS (363 operations/69 verified,
251 schemas); `node scripts/verify-runtime-split.mjs` PASS. Использована штатная
свежая API build из dev, повторная генерация DLL не нужна. Fixture lint и diff hygiene
PASS. Source schema3/client2/supplier-planning7 и Prisma validate PASS переиспользованы
с неизменными входами из предыдущих запусков задачи. Сборка/UI также переиспользованы.
НУЦ/deploy и полный release/E2E не выполнялись: вне выбранного операционного пакета.
История неудачных попыток выше сохранена; они не объявлены успешными задним числом.

Пакет опубликован в `a75a3e8`. В [CI38864735535](https://github.com/NikIg228/PlatformaMarket/actions/runs/38864735535)
сам довоз PASS, но следующий VAT/cart сценарий обнаружил оставленный BLOCKED lot
общей fixture. Исправлена тестовая изоляция: исходные статусы базовых lots и поля
balance восстанавливаются после проверки; добавлены assertions восстановления.
Из-за доказанного влияния на соседние сценарии выполнен весь PostgreSQL runner:
`npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs` — PASS,
exit0, `.tmp/resupply-flow/postgres-composition-2.log`. Runtime не менялся; прежние
UI/build/type evidence применимы. Scoped fixture lint/diff hygiene PASS.
CI первого коммита остаётся FAIL; итог исправленного коммита проверяется отдельно.

Отдельное разрешение владельца16.10: применены к локальной `marketplace` миграции
20261015090000_order_invoice_preparation, 20261015170000_order_discrepancies,
20261016010000_order_resupply. `npm run dev` запущен из canonical root в go_live;
health/API, homepage и непустой catalog-search HTTP200. Это проверка запуска,
не функциональная приёмка довоза; рабочие данные не reseed.

## 15.10 — R7.6.5.1: проект контракта исключений — PROPOSED

Поручение: подготовить правила расхождений, исправлений и возвратов, затем
согласовать до реализации. База main/6b2b383; Admin/catalog WIP сохранён.
План проверки: docs-only, сверка с DWF-07/PROJECT_OVERVIEW/функциональной картой,
schema и существующим order workflow; локальные ссылки, review diff и diff hygiene.
Риски: ложная полная приёмка, смешение недостачи с возвратом, повторное изменение
денег/остатков, подмена формы и ЭЦП операционным заявлением.

[Проект §8.1](MARKET_DOCUMENT_WORKFLOW.md#exceptions-contract-proposal) содержит
сценарии 10/8, плановую частичную партию, повреждение/неполучение/излишек,
ошибку фиксации и возврат; действия сторон, версии и API/UI-state map,
связи с существующими событиями, открытые решения и будущие критерии проверки.
Использованы development-toolkit и checklist Backend Architect: границы доменов,
contract-first, tenant/transaction/idempotency и восстановление; без субагентов.

Read-only подтверждено: получение накопительное, полностью нулевое не допускается;
возврат связан с заказом, не конкретной накладной; получение возврата не пополняет
доступный остаток автоматически. Эти ограничения учтены, новый runtime не заявлен.
Решения владельца о правилах и профильные формы/подписанты ещё не утверждены.
R7.6.5.1 остаётся OPEN/PROPOSED; R7.6.5.2/3 не начаты. НУЦ на паузе.
Проверки документации: локальные ссылки и `git diff --check` PASS.
Runtime/build/DB/browser NOT_RUN, поскольку изменена только документация.

## 15.10 — R7.6.4.1: подготовка накладной партии — SCOPED PASS

Реализован [контракт предпросмотра](MARKET_DOCUMENT_WORKFLOW.md#shipment-waybill-preview-runtime).
API/schema/client → ShipmentWaybillService/rules → WaybillRendererService →
ShipmentPanel/ShipmentWaybillPanel в /supplier/orders/:id. PDF остаётся DRAFT,
не подтверждает передачу, подпись или приёмку. SDK/запрос НУЦ на паузе;
R7.6.4.2/3 открыты. Новых миграций, рабочих данных, интеграций нет.

Доказательства на main/76d5c1d + собственный diff (foreign WIP исключён):

- npm run build --workspace=@marketplace/schemas; npm run build --workspace=@marketplace/api-client — PASS.
- npm run test --workspace=@marketplace/schemas -- shipment-waybill.test.ts — 2/2;
  npm run test --workspace=@marketplace/api-client -- shipment-waybill.test.ts — 1/1.
- Из apps/api: npm exec -- vitest run --config ../../.tmp/invoice-flow/vitest.config.mts src/modules/documents — 95/95;
  после последних guards/legacy amount правок повторены documents.service.spec.ts
  и document-consolidation-security.spec.ts — 42/42 PASS.
- npm exec --workspace=@marketplace/api -- nest build --path ../../.tmp/invoice-flow/tsconfig.json --config ../../.tmp/invoice-flow/nest-cli.json — PASS;
  tsc с тем же --path config через -p и --noEmit — PASS. Изолированный generated
  Prisma client соответствует неизменённой schema, исходники не копировались.
- npm run db:test -- exec -- node scripts/verify-postgres-integration.mjs --waybill-only — PASS;
  новый scoped flag включает invoice fixtures/dependency. Проверены partial VAT,
  tenant/role, invalid input, replay/race, stale, audit rollback, delivery links,
  запрет generic signing/старого pack. NODE_OPTIONS переключал только generated
  client/API artifacts через .tmp/invoice-flow/client-hook.cjs и client-loader.mjs.
  Использовалась штатная disposable dentmarket_audit_20260914, cleanup завершён.
- node scripts/verify-runtime-split.mjs; npm run db:test -- exec -- node scripts/verify-pilot-backend.mjs --contract-only — PASS с теми же artifacts.
- node .tmp/waybill-flow/build-web.mjs — unified web pilot build/typecheck PASS,
  отдельный distDir .tmp/waybill-flow/next; текущий dev не останавливался.
  npm run typecheck --workspace=@marketplace/e2e — PASS.
- Playwright: playwright.shipment-waybill.config.ts на canonical dev3000,
  все API замокированы, рабочие данные не затрагиваются. Основные 3/3 PASS,
  отдельный mobile PDF download/stale 1/1 PASS. Keyboard/focus/1440/390,
  Manrope14/control44/radius8 и отсутствие overflow подтверждены.
- PDF unit test и визуальная проверка Poppler: краткий1 и длинный6 страниц PASS;
  .tmp/waybill-flow/pdf, screenshots output/playwright/waybill-final и waybill-download.
- Scoped ESLint --max-warnings=0 и git diff --check — PASS. Полный release/E2E
  не запускался: task scope не является общей приёмкой или production выпуском.

Первый PG выявил nullable адрес склада: исправлен validation 409 + regression.
Browser исправления: постоянная inline ошибка в диалоге и короткая кнопка новой
версии. Финальные результаты выше; попытки/логи .tmp/waybill-flow. Commit/push
по standing permission, [skip ci] по решению владельца; публикация проверяется отдельно.

## 15.10 — R7.6.3.1: воспроизводимый пакет, внешний прогон BLOCKED

Владелец подтвердил отсутствие SDK/тестовых сертификатов. NCALayer установлен,
но локальный порт13579 не слушает; проверенная версия пока неизвестна.
Официальный [KNCA Basics protocol](https://github.com/pkigovkz/sdkinfo/wiki/KNCA-Basics-Module)
повторно сверён. SDK/мобильный доступ не получены, заявки не отправлялись.

Подготовка: npm run build --workspace=@marketplace/eds-client, затем
node scripts/prepare-nca-prototype.mjs. В .tmp/nca-prototype/packet сохраняются
оригинал без коммерческих обязательств, его однобайтовое изменение, checksums,
запрос existing client и manifest. Все реальные проверки помечены NOT_RUN.
Нет сетевой отправки, подписи, private key или подмены Kalkan mock-verifier.

Исправлена воспроизведённая ошибка NcalayerClient: мутация входного буфера во
время внешнего диалога не должна менять checksum отправленных байтов.
Client tests3/3, consumer3/3, verifier/adapters5/5, package build/types и lint PASS.
Проверки используют mocks и не доказывают валидность CMS, доверия/отзыва/TSP.

Для продолжения владельцу нужен комплект официального SDK: runtime/библиотеки,
пример проверки detached CMS, тестовые сертификаты и trust anchors, тестовые
OCSP/CRL/TSP и правила проверки. После получения передать путь к комплекту;
пароли и закрытые ключи в чат/Git не отправлять. Мобильный доступ — отдельно.
R7.6.3.1 не закрыт; подготовка не является рабочей интеграцией подписи.

## 15.10 — GENERATED-счёт R7.6.2: SCOPED PASS

Реализованы подготовка из подтверждённых реквизитов/налогового snapshot заказа,
независимая нумерация, PDF preview, отдельное подтверждение поставщиком,
неизменная история и видимость текущего счёта клинике. Контракт и права —
[DWF §17.8](MARKET_DOCUMENT_WORKFLOW.md#order-invoice-runtime).

После первоначальной остановки владелец явно поручил продолжить. Исправлены
fixtures/cleanup; полный isolated PostgreSQL, upgrade-path, core-contract,
runtime split, focused unit/client tests, API/web build/types и scoped lint PASS.
Browser3/3: supplier/clinic1440/390, keyboard, read/write retry и stale preview.
Финальные screenshots/computed styles и длинный10page PDF проверены визуально.
API/DB инварианты проверены реальным PG, браузерные состояния — API mocks.

Рабочая DB/production не менялись; НУЦ/ЭСФ/накладные не входят в пакет.
Full CI пропущен по решению владельца, feature-коммит с [skip ci].
Подробные команды, неудачные попытки, cleanup и пути evidence —
[checkpoint R7.6.2](../governance/task-state/PRIMARY-SESSION.md).

## 14.10 — подготовка налоговой цепочки R7.6.1.4

Профиль реквизитов уже реализован отдельным пакетом. Сверены существующие
коммерческие поля, формы, revalidation и writers ERP/override; повторная
реализация этой основы не нужна. В [DWF §17.6.1](MARKET_DOCUMENT_WORKFLOW.md#supplier-vat-proposal)
добавлен проект расширения режимов, точного расчёта, снимков и совместимости.
Применимость ставок, дата оборота, налоговое округление и переход старых
предложений ещё требуют решения. Продуктовый налоговый код в этом пакете
не менялся; R7.6.1.4 остаётся открытым. Проверки подготовки: source review,
согласованность документации и diff hygiene; runtime checks не требуются.

## Выполненная подготовка

13.10 зафиксирована принятая B2B-цепочка, участники и полномочия, документы,
версии, подписи, исключения, архив и отрицательные сценарии приёмки.
Спецификация опубликована в `d4e1db8`. 13–14.10 требования интегрированы в R7.6:
восемь пакетов с проверяемыми подшагами, связями с Admin и отдельной технической
проверкой НУЦ. Это завершённая подготовка требований, не приёмка полного workflow.

## Существующая основа и пробелы

В проекте есть документы заказа и механизмы подписей. Выборочная сверка,
зафиксированная в основном roadmap на `d4e1db8`, выявила два существенных разрыва:
`OrderWorkflowService.document` принимает только UPLOADED, а завершение подписи
в `DocumentsService.refreshDocumentSignatureStatus` определяется количеством
подписей. Для целевого процесса нужны выпуск генерируемых документов и проверка
обязательных сторон, исключающая ложное завершение двумя подписями одной стороны.

На 14.10 read-only инвентаризация R7.6.1.1 завершена и сверена primary.
Результат ниже — карта существующей реализации и пробелов; этот подшаг не требует
новой реализации, миграций или runtime suite. Карта входит в текущую docs-публикацию.
Mock-подпись, прототип НУЦ и прежний UI не доказывают рабочую внешнюю интеграцию.

## 14.10 — инвентаризация R7.6.1.1

Подготовка PlatformaMarket UI на `2885f6f`, review primary на `37fa69a`.
В documents module, order-workflow service/schema и просмотренных общих document
components между этими версиями изменений нет; auth migration относится к AuthSession.
Повторно сверены модели Document/Participant/Signature/Shipment, запрет GENERATED
при ISSUE_INVOICE, ограничения pack, счётчик подписей и canonical UI entry points.

Общие входы:
[Prisma](../../apps/api/prisma/schema.prisma),
[схемы документов](../../packages/schemas/src/index.ts),
[workflow schema](../../packages/schemas/src/order-workflow.ts),
[signature evidence schema](../../packages/schemas/src/commercial.ts),
[DocumentsService](../../apps/api/src/modules/documents/documents.service.ts),
[HTTP documents](../../apps/api/src/modules/documents/documents.controller.ts),
[HTTP order documents](../../apps/api/src/modules/documents/order-documents.controller.ts),
[OrderWorkflowService](../../apps/api/src/modules/commerce/order-workflow.service.ts),
[API client](../../packages/api-client/src/index.ts).

| Требование | Существующая основа | Конкретный пробел / следующий пакет |
| --- | --- | --- |
| DWF-01 модель | Document содержит source, связи заказа/партии/платежа, storage/hash/snapshots; версия — отдельный Document с previousVersionId и уникальным owner/number/version | Типизированные снимки сторон и полномочий, неизменяемый план подписей и отдельная комплектность: R7.6.1.3; не создавать вторую систему версий |
| DWF-02 цепочка | prepareOrderDocuments генерирует specification/invoice; pack добавляет waybill; ISSUE_INVOICE отдельно фиксирует счёт заказа | ISSUE_INVOICE требует UPLOADED/CLEAN даже для GENERATED. R7.6.2: source-specific проверка, актуальный snapshot и явное подтверждение поставщиком; сохранить защиту загруженных файлов |
| DWF-03 стороны | DocumentParticipant, signer org/user, tenant/reference checks и общий permissions guard; принятие supplier terms фиксирует actor/version | Утверждённое основание полномочий, повторная проверка при commit и план обязательных сторон отсутствуют; operator exception не является правом подписывать за участника |
| DWF-04 реквизиты | kind enum, template/data snapshot, renderer/hash, детерминированные номера заказа/отправления | Generic data не задаёт принятый набор банковских/налоговых/адресных реквизитов; нет согласованной маски номера и источника идентификатора ИП. Внешние решения R7.6.1.2 |
| DWF-05 версии/полнота | createVersion создаёт новую запись/файл и SUPERSEDED старую; signature связана с documentId | Нет полного expected business revision/idempotency correction контракта; refreshDocumentSignatureStatus считает SIGNED без проверки разных обязательных сторон. Отдельная completeness projection не обнаружена |
| DWF-06 подпись | NCALayer client, local session, gateway verification/callback, HMAC/replay/checksum/BIN/cert evidence checks | Реальная НУЦ-проверка не доказана; поздний expired/final результат отвергается, durable reconciliation и оригинальный CMS в архиве не обеспечены просмотренным путём. R7.6.3 |
| DWF-07 партии | Shipment/ShipmentItem, quantities/deliveredQuantity, order locking в логистике; RECEIVE_SHIPMENT отдельно меняет физическое исполнение | Pack требует уже DISPATCHED и PAID; нужна накладная до отправки, сумма частичной партии, связь документального принятия с версией и исправление10/8. Не повторять существующий возврат денег/остатков |
| DWF-08 SMS | Канал уведомлений и auth MFA существуют отдельно | Нет proof конкретного получения/версии или принятого входа личного заказа в просмотренном document contract. R7.6.6/R5.3; не добавлять B2C-checkout как побочный эффект |
| DWF-09 архив | Scoped archive list/summary/get/download, версии, checksum, accounting expectedUpdatedAt; backup restore проверяет object inventory | Не обнаружены полный signature proof/original CMS, export manifest, business completeness, согласованные retention/legal hold и access после отключения. R7.6.7 отдельно от infrastructure R8.2 |
| DWF-10 UI | Canonical workspaces/documents → DocumentRegistry/DocumentDetailPanel; order-detail → OrderWorkflowWorkspace | Счёт в canonical flow upload-only; отсутствуют generate-preview-confirm, подписание/приёмка той же версии, комплектность и документальное исправление. Legacy prepare/pack не доказывает canonical flow |
| DWF-11 evidence | Историческая приёмка реестра и целевые regression tests доступны | Нет общей приёмки generated issue → обе НУЦ стороны → correction → originals archive/restore. R7.6.8/R7.3 не закрыты |

Покрытие для последующего выбора gates: documents `document-reference-isolation`,
`document-consolidation-security`, `documents.service`, `document-renderer`;
commerce `order-workflow`; logistics `shipment-state`; agreements
`eds-signature-verification.service` и `signature-callbacks.service`;
schema `document-upload-money`, `document-archive-query`, `document-relations`;
browser `documents-registry`, `document-relations`, `document-upload`.
Наличие этих тестов не означает их новый PASS. Историческое evidence находится в
[карточке реестра](../governance/task-state/DOCUMENTS-REDESIGN-2026-10-08.md).

UI-источники:
[canonical documents](../../apps/web/app/workspaces/documents.tsx),
[canonical order](../../apps/web/app/workspaces/order-detail.tsx),
[registry](../../packages/ui/src/document-registry.tsx),
[detail](../../packages/ui/src/document-detail-panel.tsx),
[workflow](../../packages/ui/src/order-workflow-workspace.tsx).
Следующая реализация начинается с выбранного связного контракта/backend/UI,
а не с массового изменения всех одиннадцати требований. Неизвестные формы,
полномочия и внешний доступ остаются в журнале вопросов.

## 14.10 — предварительное исследование НУЦ, R7.6.3.1

Read-only сверка кода на `37fa69a` и открытых первичных источников. Продуктовый
код, зависимости, рабочие данные и внешние настройки не менялись. Это подготовка
прототипа, а не его PASS; R7.6.3.1 остаётся открытым.

Существующий [eds-client](../../packages/eds-client/src/index.ts) отправляет байты
в base64 в `kz.gov.pki.knca.basics/sign`: CMS, decode=true, encapsulate=false,
digested=false. Это соответствует описанию detached CMS в
[официальном SDK wiki](https://github.com/pkigovkz/sdkinfo/wiki/KNCA-Basics-Module).
Передаваемый `tsaProfile: {}` по этому описанию запрашивает метку времени;
фактический контейнер, доступность TSP и проверка метки ещё не доказаны.
Источник найден через [ответ на форуме НУЦ](https://forum.pki.gov.kz/t/dokumentacziya-po-kz-gov-pki-knca-basics/4251),
ссылающийся также на [пример НУЦ](https://github.com/pkigovkz/NCALayerJSExample).

[Серверная проверка](../../apps/api/src/modules/agreements/eds-signature-verification.service.ts)
делегирует криптографию в `SIGNATURE_GATEWAY_URL/verify`, затем сверяет структуру
evidence, checksum, БИН и срок сертификата. Реализация Kalkan в просмотренных
исходниках отсутствует. [Реестр адаптеров](../../apps/api/src/modules/documents/signature-adapter-registry.service.ts)
при отсутствии gateway вне production использует mock; это не доказательство
работоспособности НУЦ. Unit tests WebSocket/проверки evidence не заменяют реальный CMS.

[Страница разработчиков НУЦ](https://pki.gov.kz/ru/developers/) описывает получение
SDK с библиотеками и тестовыми сертификатами владельцем ИС/представителем через
[портал SDK](https://sdk.pki.gov.kz/). Там же опубликованы адреса TSP, OCSP и CRL.
Наличие адреса не доказывает проверку цепочки, отзыва или долгосрочную пригодность
нашего evidence. В репозитории не найдены именованные SDK/Kalkan artifacts;
наличие комплекта у владельца вне репозитория пока неизвестно.

Для мобильного пути [сообщение НУЦ от07.10.2022](https://pki.gov.kz/ru/2022/10/07/qr-подписание-посредством-egov-mobile/)
прямо указывает на [сервис Smart Bridge NITEC-S-5096](https://sb.egov.kz/smart-bridge/services/passport/NITEC-S-5096).
Паспорт сервиса не удалось прочитать используемым web-инструментом; актуальные
условия доступа, API и поддержка полномочий юридического лица не подтверждены.
Нельзя выводить их из стороннего API либо пользовательской инструкции eGov.

Следующий проверяемый результат: получить разрешённый SDK/тестовые сертификаты,
зафиксировать версии и выполнить detached CMS над известными байтами с серверной
проверкой оригинала, изменённых байтов, чужой стороны, цепочки, отзыва и TSP.
Отдельно подтвердить контракт и доступ к NITEC-S-5096, затем cancellation,
неизвестный исход, поздний результат и mobile return. Секретные ключи и пароли
не сохранять в Git/evidence. Заявки и сообщения от имени владельца не отправлялись.

## Как дополнять журнал

После каждого этапа записать R-ID, сценарий и переходы состояний, изменения
схемы/API/backend/UI, применимые права и инварианты, проверки с evidence,
commit и статус CI. Для документов указывать, чем доказаны версии, состав
обязательных сторон, идемпотентность и запрет чужого tenant, если они затронуты.
Краткое описание сопровождает обновление основного roadmap; вопросы и выбранные
варианты фиксируются в [журнале решений](../governance/ROADMAP-QUESTIONS-AND-DECISIONS.md).


<a id="discrepancy-statements"></a>
## 15.10 — R7.6.5.2: операционное заявление, ответы и история

Поручение владельца после согласования §8.1 DWF. База main/483eba1; canonical
checkout. Pipeline каталог → корзина → отдельные заказы поставщиков → состав →
счёт → оплата → партии → получение/документы описан в
[DWF §3](MARKET_DOCUMENT_WORKFLOW.md#order-pipeline).

Реализована выбранная часть R7.6.5.2, не весь документальный пакет:

- Клиника создаёт сохраняемый DRAFT по отправленной партии, указывает тип,
  обязательную причину, точные фактические/повреждённые количества и решение.
  Фото/PDF необязательны; PDF/PNG/JPEG до 5 МБ, до 10, проверка quarantine/CLEAN.
- SUBMIT сохраняет редакцию и снимок источника; дальнейшая правка заявления
  запрещена. Поставщик не видит черновик, его вложения и историю редактирования.
- Поставщик согласует предложенное клиникой решение, отклоняет с причиной или
  предлагает другой вариант. COUNTER → RESOLUTION_PROPOSED требует явного DECIDE
  клиники. После REJECTED можно создать новую связанную редакцию.
- AGREED означает согласованное решение. Нет RESOLVED, подписания, автоматического
  согласия, допоставки, изменения количества получения, денежного/складского эффекта.
  Полностью нулевое заявление разрешено; оно не подменяет RECEIVE_SHIPMENT.
- Связь с накладной допускается только для доступной клинике выпущенной версии
  этой партии с checksum. Supplier-only preview не раскрывается. При отсутствии
  выпущенной накладной источник явно null. Ошибка получения требует ссылки на
  действительное RECEIVE_SHIPMENT этой партии.

Контракт: [order-discrepancy.ts](../../packages/schemas/src/order-discrepancy.ts).
GET/POST /supplier-orders/:orderId/discrepancies; POST .../attachments;
GET .../:discrepancyId/attachments/:assetId. Zod strict, OpenAPI и api-client
согласованы. Read: участник заказа с order.create/order.confirm; write клиники —
order.approve, поставщика — order.confirm. Чужой объект — 404, неверная сторона/роль —
403, неверный payload — 400, версия/переход/ссылка — 409; стандартный error envelope.

[Сервис](../../apps/api/src/modules/commerce/order-discrepancy.service.ts) блокирует
SupplierOrder перед проверкой replay и трёх версий. Replay привязан к actor/org,
key и hash; событие, новая версия, audit и outbox атомарны. DRAFT/SAVE не создают
межсторонний outbox. История хранится в OrderDiscrepancyEvent отдельно от финансового
workflow. Миграция 20261015170000_order_discrepancies добавляет две таблицы и связи,
не переписывает старые события/документы. Рабочая БД не мигрировалась.

[UI](../../packages/ui/src/order-discrepancy-panel.tsx) в существующей вкладке
«Отгрузки» карточек clinic/supplier/orders/:id: состояние, количества, причина,
вложения и хронология. Черновик восстанавливается после перезагрузки; при отказе
ввод остаётся. Неизвестный исход повторяет ровно прежнюю команду/key; 409 требует
обновления и явной сверки. Shared DmDialog/mobileFullscreen и adapters/tokens.

Evidence (локальные ignored artifacts .tmp/discrepancy-flow и output/playwright):

| Проверка | Команда / результат |
| --- | --- |
| Схемы | schemas build; vitest src/order-discrepancy.test.ts — 2 PASS |
| Сервис/правила | API vitest с изолированным Prisma client: 5 service + 3 rules PASS; service повторён после уточнения единицы упаковки |
| API build/types | tsc -p .tmp/discrepancy-flow/tsconfig.json, отдельный api-dist — PASS; client не заменяет dev client |
| Prisma | prisma validate — PASS; generate в .tmp/discrepancy-flow/client; additive upgrade в транзакционном тестовом schema |
| PostgreSQL/API | db:test → verify-postgres-integration.mjs --discrepancy-only: две партии, дроби/zero, tenant/party/role, вложения, replay/race, rollback outbox, неизменность денег/остатков/получения — PASS |
| Core-contract | db:test → verify-pilot-backend.mjs --contract-only с актуальным isolated API: response/error validation PASS; 363 operations / 251 schemas / 69 core checks |
| Runtime split | verify-runtime-split.mjs с isolated API — API/worker/all и production guards PASS |
| Client | api-client build + vitest src/order-discrepancy.test.ts — 1 PASS |
| Frontend | ui/web typecheck; isolated Next production build (49 pages) — PASS |
| Browser | playwright.order-discrepancy.config.ts — 4 PASS: desktop1440/mobile390, read/write recovery, reload draft, stale review, both parties/counter/accept/reject/revision, denied role, keyboard/focus |
| Visual | discrepancy-before.png; discrepancy-final-1440.png / discrepancy-final-390.png просмотрены; Manrope14/control44/radius8, no viewport overflow; 2 финальные visual/keyboard проверки PASS |
| Hygiene | scoped ESLint и git diff --check; links/consistent scope |

Browser использует intercepted fixture API и не считается HTTP/DB integration:
это доказано отдельным PostgreSQL gate на dentmarket_audit_20260914.
Первый Prisma validate не получил DATABASE_URL, исправлен read-only validation URL.
Первые два запуска PG остановились до сценария из-за Windows loader URL и отсутствующих
fonts в isolated build; третий PASS. После уточнения единицы упаковки и cleanup
финальный focused PG rerun также PASS (postgres-final.log). Первый browser run выявил потерю фокуса после
смены состояния, второй — после отказа; третий все 4 PASS. После группировки блоков
и scroll-to-top выполнена только затронутая visual/keyboard сверка. Первая web build
остановлена исполнителем при UI-исправлении; финальная сборка PASS. Client-test исправлен
под фактический fetch GET (метод по умолчанию); повтор PASS.

НУЦ, подписи, формы исправления/возврата, исполнение допоставки/денежного уменьшения,
финальное закрытие и полный R7.6.5.3 NOT_RUN/вне выбранного пакета. Full release/E2E
не требуются для этого scope. CI не запускать по постоянному решению владельца [skip ci].
