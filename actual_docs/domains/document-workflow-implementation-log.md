# Документооборот — выполненные этапы и технические решения

Обновлено 15.10.2026. Журнал реализации полного документального процесса сделки.
Требования — [Workflow документооборота](MARKET_DOCUMENT_WORKFLOW.md), единственный
checklist — [R7.6 основного roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md#document-workflow).

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
