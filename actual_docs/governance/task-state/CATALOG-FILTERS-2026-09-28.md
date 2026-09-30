# CATALOG-FILTERS — компактная фильтрация каталога

Владелец: PlatformaMarket UI / 01a0e834-6e44-7a81-a438-ea859da9728b.
Основание: поручение владельца через боковую беседу 01a0e912-d086-70d2-9db0-b3cbc0bbd4c1.
Состояние: реализовано, не проверено по указанию владельца.
Checkout: C:\Users\user\Desktop\dentmarket-kz-main, main646dab585eda96bb21c994b92c611fbf13e56179.
Основная задача миграции idle/completed по native readback перед записью.
Весь прежний UI/API/unified WIP сохранён; новые worktrees/агенты не создаются.

Scope: sticky строка с наличием/ценой/брендом/сортировкой, компактная категория
и реальные характеристики слева без внутреннего скролла, доступная полная
панель с черновиком до применения. Глобальные deliveryCityId/inCity сохраняются
при сбросе и не входят в счётчик. Поиск/URL/возврат/точные цены сохраняются.
Нет новых API/БД/зависимостей, бесконечной прокрутки или редизайна карточек.
Текущая unified поверхность импортирует buyer-workspace/CompactCatalog.
Прежнее исправление дублей по product.id и отдельный nextOffset сохраняются.

Прочитаны AGENTS/Workflow/context, UI Implementation Standard, инструкции
Agency Frontend Developer/UI Designer: feature decomposition, единые controls,
keyboard/focus, responsive и состояния. Это практики, не отдельные агенты.
DoD реализации: указанная компоновка и единое состояние, отмена черновика при
закрытии, price validation, доступное закрытие/фокус, mobile dialog.
Проверки/tests/build/browser/diff-check, commit/push: NOT_RUN, запрещены последним
указанием владельца до отдельного запроса. PASS не объявлять.
Процессы не запускались/не останавливались, рабочие данные не меняются.
Выполнено:
- CompactCatalog: горизонтальная лента категорий снята; поиск сохранён один.
  Sticky toolbar под фактической высотой header: total, наличие, price/brand
  popovers, один select сортировки, Все фильтры со счётчиком. RELEVANCE называется
  «По релевантности», возможность предзаказа интерфейс не обещает.
- catalog-filter-model/controls/toolbar/dialog: единая модель, точные цены,
  price range считается одним фильтром, одно значение бренда с поиском.
  Категория/подкатегория — один иерархический список. Несовместимые атрибуты
  сбрасываются. Полная панель — Fluent Dialog, desktop справа/mobile full-screen,
  доступное закрытие и возврат фокуса. Черновик и его reset не меняют выдачу
  до «Показать товары». Закрытие удаляет черновик.
- Sidebar: category + первые три реально доступных filterable характеристики,
  Все фильтры; нет собственного overflow/scroll или обрезания. use-catalog-layout
  измеряет высоту, отключает sticky при нехватке окна; narrow sidebar скрыт.
- buyer-workspace: добавлен read-only loader справочников категории для черновика
  через прежний public/authorized search transport. Новые API/схемы не создавались.
- URL/query/global city сохраняются; применение сбрасывает count и возвращает
  к началу списка при глубокой прокрутке. Снятие меток и общий reset не меняют
  город/inCity. Прежний nextOffset/dedupe product.id сохранён.
- Новые unit cases в catalog-filter-model.test.ts: глобальный город/query при
  reset, единый price counter, точные большие суммы, category/attributes reset.
  Тесты написаны, но не запускались. Browser/TS/build/diff-check также NOT_RUN.

Изменённые области: apps/buyer-web/app/features/catalog/{compact-catalog.tsx,
compact-catalog.module.css,catalog-filter-*,catalog-filters.module.css,
use-catalog-layout.ts}, callback в buyer-workspace.tsx, этот checkpoint.
Фактическое состояние интерфейса, типизация, focus/overlay/mobile и регрессии
не приняты без запуска проверок. Готовность каталога/миграции не утверждается.
Следующий шаг: пользовательский просмотр; проверки только после отдельного
указания владельца. Commit/push/CI не выполнялись. Собственных процессов нет.

## Уточнение владельца: три элемента в шапке каталога

Последнее прямое поручение заменяет описанную выше компоновку с sidebar и
быстрыми фильтрами. Реализовано, runtime/визуально не проверено:
- Sticky toolbar: поиск с кликабельной лупой внутри поля и Enter, иерархический
  селектор категорий, «Все фильтры». Отдельная кнопка «Найти» снята.
- Боковая панель, метрики количества товаров и быстрые наличие/цена/бренд/
  сортировка сняты. Категория не дублируется отдельным контролом в инспекторе.
- Сортировка перенесена в черновик полной панели и применяется по «Показать
  товары»; закрытие отменяет черновик. Reset возвращает RELEVANCE.
- Сетка на всю ширину: 5 колонок от 1280px, затем 4/3/2/1; высота фото 170px
  на широком экране. Названия и цены не уменьшены. На мобильном поиск над
  категорией и кнопкой фильтров.
- Глобальный город, URL, applied chips, nextOffset и dedupe сохраняются.
- Использованы ранее прочитанные практики Agency Frontend Developer/UI Designer:
  общие Fluent controls, responsive layout, aria-label для кнопки поиска,
  прежние focus/keyboard и loading/empty/error состояния.
- Проверки, тесты, сборка, браузер, diff-check, commit/push НЕ выполнялись по
  прямому указанию пользователя. PASS не заявляется. Ветка main, исходный HEAD
  646dab585eda96bb21c994b92c611fbf13e56179. Рабочие данные и процессы не менялись.
- Первая попытка файлового редактирования через python не выполнилась: runtime
  отсутствует. Изменения выполнены через установленный Node, это не test gate.

## Уточнение: компактный поиск и город рядом с фильтрами

По прямому запросу владельца поиск ограничен шириной 560px. Существующий
HeaderCity перенесён в sticky toolbar каталога, использует прежний DeliveryProvider,
URL/storage и настройку доступности. В верхней шапке каталога дубль снят через
showCity; на других экранах прежний селектор остаётся доступным.
Категории, город и кнопка фильтров имеют единое скругление 8px (dm-radius-button).
На узких экранах поиск занимает отдельную строку, остальные элементы переносятся;
панель города привязана к своему контролу, с ограниченной высотой.
Практики прежних Frontend Developer/UI Designer: повторное использование
контекста/компонента, единые токены, responsive и keyboard/focus.
Реализовано без тестов, сборок, browser/diff checks, commit/push по указанию
пользователя. Результат визуально не проверен. Main, без нового commit.

## Диагностика STATUS_BREAKPOINT после чекбокса города

Прямое поручение пользователя: детальный анализ и наблюдение поведения;
разрешена точечная runtime-диагностика, запрет commit/push сохраняется.
Код приложения не изменён. Выполнено через CUA, без запуска новых серверов:
- IAB: включение/снятие/повторное включение inCity. Каталог загружается, 24
  карточки; JS errors не зарегистрированы. uncheck tool вернул timeout после
  навигации, но следующий DOM/URL подтвердил снятие и загруженный каталог.
- Chrome 153.0.8010.53: включение и снятие, в обоих случаях 24 карточки,
  JS errors []. Падение не воспроизведено. Диагностические вкладки закрыты.
- CDP trace одного включения в IAB: 1 Document navigation, GET /api/catalog/cities
  200, GET /catalog-search с cityId и limit24/offset0 200, loadingFailed нет.
  За наблюдённый интервал нет цикла запросов/навигаций.
- Код: header-city.tsx:22 -> delivery.choose -> delivery-context.tsx:50
  window.location.assign. Каждый toggle полностью перезагружает документ.
  buyer-workspace.tsx:289 передаёт cityId в поиск только при inCity=true.
- Локально прочитаны minidump 846ab291-8185-4eb0-8832-9ae21bb017c3.dmp
  (2026-09-28 23:49:33) и 7579803f-909c-49b6-8999-379f2cbf32ed.dmp
  (19:16:09): оба exception 0x80000003, chrome.dll+0xc1cc6ad.
  Дампы/их содержимое наружу не передавались. Символьный стек не получен:
  совпадение сигнатуры не доказывает первопричину.
- RAM 8074104 KiB total, free 415992 затем 283676 KiB; virtual free
  11646920 из 30094200 KiB. Node 75 процессов, private committed 4.97GiB;
  Chrome16, private committed1.31GiB. Это не resident RAM и не доказательство OOM.
- Dev frontend PID5924 и API17816 командные пути из canonical repo.
- Версия Chrome/ресурсы прочитаны штатно. Настройки, расширения и процессы не
  менялись. User original failed tab не перезагружалась и не закрывалась.
Вывод: реальное native Chrome crash с прежней сигнатурой. Воспроизводимость
в текущей диагностике отсутствует; JS/API/infinite reload дефект не выявлен.
Низкая свободная RAM — возможный фактор, а не установленная причина.
Следующий инженерный шаг: согласованно заменить hard reload переключателя
на обновление URL+состояния/выдачи, с синхронизацией back/forward; это уменьшит
нагрузку перехода, но не является доказанным исправлением native Chrome crash.
Сборки, общие тесты, commit/push NOT_RUN; эта диагностика не принимает весь UI WIP.

## Реализация обновления города без полной перезагрузки

Прямое согласие пользователя на предыдущую рекомендацию, с сохранением
функционала селектора. Изменён только delivery-context.tsx и этот checkpoint.
- Catalog choose сохраняет localStorage, обновляет city/inCity контекст,
  pushState + popstate запускают существующее восстановление фильтров/поиск.
- Back/forward синхронизируют контекст с URL без повторной загрузки городов.
- Снятие выбора города сбрасывает inCity; неизвестный id не принимается.
- Product detail server offers обновляются через router.push (scroll:false),
  первоначальная подстановка сохранённого города — router.replace.
- destination сохраняет остальные фильтры и сбрасывает пагинацию как раньше;
  одинаковый URL не создаёт повторную запись истории.
Тесты, сборка и browser verification НЕ запускались согласно прежнему запрету;
предыдущие диагностические наблюдения не являются проверкой этого изменения.
Это устранение hard reload, а не подтверждённое исправление native Chrome crash.
Commit/push нет. Branch main, исходный HEAD646dab585eda96bb21c994b92c611fbf13e56179.
Практики: прежние Frontend Developer — единый context, прежний URL contract,
разделение client catalog и server product data, cleanup listener.

## 2026-09-29: ошибка карточки после поисковой подсказки

Пользователь уточнил: переход из результатов подсказки, не смена города.
Диагностика: frontend3000 PID5924 слушает; API4012 не слушает. GET compare
известного каталожного productId без города и с Павлодаром оба fetch failed.
Позднее обнаружен API process20420, но listener4012 по-прежнему отсутствует.
Не заявлять причину остановки API или исправление его runtime; процессы не
запускались/не останавливались. Конкретный проблемный productId не предоставлен.
Изменение frontend: ProductPage обрабатывает recoverable getProduct failure
через ProductLoadError (общий ErrorState, retry router.refresh, back с returnTo,
header/city сохраняются). Metadata при недоступности API получает общий title.
404 остаётся notFound; цены/остатки не подменяются статическими данными.
Проверки после правки, сборка, commit/push NOT_RUN по указанию владельца.
Следующий шаг окружения: восстановить API4012 в исходном профиле запуска,
затем пользовательский повтор открытия карточки. Исправление экрана ошибки
не восстанавливает backend и не подтверждает успешную загрузку предложений.

## 2026-09-29: категории — обычный dropdown и единый стиль панели

По запросу пользователя: FilterChoice получил searchable=false для категорий;
используется Fluent Dropdown без поля поиска, остальные поисковые списки
сохраняют Combobox. Popup inline с fixed positioning below/start; listbox
ограничен по высоте, overflow-y:auto и overscroll-behavior:contain предотвращают
передачу прокрутки странице на границах списка. Полная блокировка body не нужна.
Город использует Fluent ChevronDown20Regular вместо текстового треугольника;
целенаправленный поиск ▾/▼ в apps и packages/ui нашёл только заменённое место.
Город, категории, Все фильтры: font-size14px/font-weight600. Состояние/URL/фильтрация
не менялись. Общая библиотека Fluent остаётся единственной системой controls.
Browser/tests/build/diff-check NOT_RUN по прежнему указанию пользователя;
позиционирование и scroll пока не подтверждены runtime. Commit/push нет.

## 2026-09-29: единая рамка селекторов без нижней подсветки

В исходных стилях Fluent Dropdown подтверждены отдельный ::after focus underline
и отдельный hover borderBottomColor. В общих packages/ui styles для Dropdown,
Combobox, Select выключен декоративный ::after и задан равномерный border-color
в обычном/hover/active/focus состоянии. Invalid/disabled рамки не переопределяются.
Существующий keyboard focus-visible outline сохранён. Изменение общее для
селекторов проекта; кнопки действий/их заливка не менялись.
Проверки/tests/build/browser/commit/push NOT_RUN по указанию пользователя.

## 2026-09-29: причина бокового/верхнего открытия Fluent списков

Прочитана реализация useComboboxPositioning: default fallbackPositions включает
above/after/before; position:below ранее не запрещал такие переходы. В общей UI
библиотеке добавлен dmDropdownPositioning: below/start, pinned:true (отключает
flip middleware), fallbackPositions:[], autoSize:height, matchTargetSize:width,
fixed, viewport padding8. Применён ко всем найденным Dropdown/Combobox приложения
(категории, остальные FilterChoice, CityPicker). Длинные списки используют
доступную высоту и overflow, короткие сохраняют естественную высоту.
Нативный DmSelect не переписывался: popup управляется браузером/ОС, его направление
не контролируется Fluent positioning. Не объявлять абсолютную унификацию native
select без отдельной замены его контракта/обработчиков.
Проверки/browser/build/commit/push NOT_RUN по прежнему указанию владельца.

## 2026-09-29: воспроизведён crash кликом именно по label

Пользователь локализовал trigger: текст чекбокса, не input. В Chrome CUA
getByText exact click воспроизвёл потерю ответа Input.dispatchMouseEvent и новый
Crashpad f67ba1d4-f6fa-4e85-a49e-4d7df8583942.dmp 00:28:17.
В HeaderCity onBlur закрывал details при relatedTarget=null (переход фокуса
при label activation), скрывая связанный input во время клика по подписи.
Заменён immediate onBlur на document focusin: закрытие только при фактическом
переходе фокуса наружу; pointerdown снаружи и Escape сохраняются, cleanup обоих
listeners. Нативный label/input и обработчик фильтра не менялись.
После исправления в той же Chrome-вкладке: reload, открыть город, два клика
именно по label успешно сняли/поставили checked, панель открыта, карточек24,
финальный URL inCity=true. Вкладка закрыта. Это узкая диагностика указанного
сбоя, не весь regression suite. Typecheck/build/unit/commit/push NOT_RUN.
Первый node edit имел syntax error до записи; повторная команда внесла правку.

## 2026-09-29: просмотр каталога без заголовка

Удалён видимый заголовок «Каталог для стоматологий» вместе с его контейнером.
Возврат к началу выдачи при изменении фильтров привязан к началу catalog +
padding вместо удалённого header. aria-label секции сохранён.
Фон пока не менялся: пользователь запросил мнение; предложен мягкий зелёный
радиальный градиент по примеру product page (79 212 154 /12%).
Проверки, сборки, commit/push NOT_RUN по прежнему указанию пользователя.

## 2026-09-29: мягкий градиент фона каталога

Пользователь согласовал предложенный фон. В publicStore заменён #f4f1eb на
почти белую основу #fafcfb с двумя радиальными переходами: зелёный слева12%,
бирюзовый справа10%. Белые карточки и панель фильтров сохранены.
Проверки/browser/build/commit/push NOT_RUN по прежнему указанию пользователя.

## 2026-09-29: фон контейнера фото в каталоге

По запросу владельца .photo наследует белый background карточки вместо
серо-зелёного #f5f7f6. Файлы изображений, размеры и object-fit не менялись.
Проверки/build/browser/commit/push NOT_RUN по прежнему указанию пользователя.

## 2026-09-29: компактный верх карточки товара

Удалены breadcrumbs «Каталог / категория» и повтор category/eyebrow над h1
из общего ProductPage. Back link сохранён. Shell padding-top30→16, hero top28→16
и bottom58→32. Колонка фото ограничена340px вместо500, mobile300px, фото contain.
H1 уменьшен ровно вдвое по clamp desktop36/5vw/62→18/2.5vw/31 и mobile
34/11vw/44→17/5.5vw/22; перенос длинных названий сохранён. API/данные не менялись.
Проверки/browser/build/commit/push NOT_RUN по прежнему указанию владельца.

## 2026-09-29: подготовка публикации всех изменений — BLOCKED

Пользователь явно запросил push всех изменений. Canonical main, origin
https://github.com/NikIg228/PlatformaMarket.git. Fetch выполнен, ahead/behind0/0.
Рабочий набор включает UI, unified app, API/domain/order-workflow и2 migrations,
а не только собственные правки каталога. Прежний WIP не удалялся и не staging.
- npm run typecheck: PASS13/13,5 cached, session14580.
- npm test attempt1: FAIL landing unified-navigation timeout5000ms при параллельном
  typecheck/двух пакетах. Assertion failure не было, конфигурация теста не менялась.
- attempt2 npm exec -- turbo test --concurrency=1: PASS12/12,6 cached,session15757.
  Причина повтора — устранение конкурирующей нагрузки, timeout не увеличивался.
- git diff --check (tracked): PASS. Не означает review untracked/staged.
- Git Workflow Master прочитан и применён для fetch/FF и разделения WIP/evidence.
Блокер: INTERNAL-PILOT checkpoint сохраняет незавершённый order-workflow и
pending contract/PG/runtime/browser acceptance; FRONTEND-DEMO прямо запрещает
публикацию при deferred invoice-upload whole-project web failure. Новые TS/unit
результаты этого не закрывают. По Workflow5.1 непроверенный WIP/failed gate не
публикуется. Backend доработка, working DB writes и изменение dev процессов
не выполнялись. Не делать вид, что все обязательные gates PASS.
Commit/push/CI NOT_RUN. Staging не выполнялся. Следующий шаг — завершить
приёмку order-workflow/invoice-upload на изолированной DB, затем review всего
набора, required gates и публикация. Разрешение на push сохранено, повторно его
спрашивать не требуется после устранения блокеров. Own running processes нет.

## 2026-09-29: повторный запуск dev и публичный каталог
Startup из canonical main646dab5 на audit DB требует PUBLIC_CATALOG_ORGANIZATION_ID=9ef277ae-e997-4078-8b4f-a6275c9b9a03 (существующая demo BUYER, bin970000000001). Default ID launcher отсутствует в этой DB: /catalog-search возвращал404 Buyer organization not found, несмотря на health/page200. Существующая организация проверена read-only. Own launcher35395 штатно остановлен, порты освобождены, новый31481 запущен с явным ID. Лог outputs/unified-application-20260928/dev-catalog-20260929.log. Данные БД/исходный код не менялись, no commit/push. Проверка каталога pending.
Readiness PASS: точный публичный запрос /catalog-search?q=&sort=RELEVANCE&limit=24&priceBasis=SALE_UNIT&includeFilterOptions=true&offset=0 вернул total50/items24. API healthy, unified Next ready. Launcher31481 оставлен работающим.

## 2026-09-29: условия предложений и исследование описаний
Удалён только panelKicker Коммерческие условия из общего ProductPage. Подготовлен actual_docs/ui-ux/TEST-PRODUCT-DESCRIPTIONS-2026-09-29.md:50 позиций текущего каталога с ID, краткими редакторскими описаниями и URL производителей; варианты/неопределённые REF помечены. Предложен стандарт блока, импорт в БД/подключение описаний в UI не выполнялись: запрос на поиск и предложение стандарта. Tetric N-Bond classification issue отмечен без переименования. Применена прочитанная Agency Frontend Developer практика minimal existing component edit; web research primary manufacturer sources. Tests/build/browser/push не запускались по прежнему указанию владельца. Canonical main646dab5, остальной WIP сохранён.

## 2026-09-29: отображение исследованных описаний
По явному запросу подключены50 описаний из исследовательского документа в блок Характеристики: статический curated JSON и отдельный feature-компонент, точное соответствие id+name. Выводится описание, пометка об уровне линейки и ссылка производителя. Прежние реальные attributes сохранены; empty-заглушка скрыта при наличии исследованного описания. Для неизвестных товаров прежний fallback сохранён. БД/API не менялись. Источники не загружаются в runtime, данные server-rendered. Tests/build/browser/commit/push NOT_RUN по прежнему указанию. Main646dab5, чужой WIP сохранён.

## 2026-09-30: убрать характеристики, расширить предложения
По запросу удалён блок Характеристики целиком из общего ProductPage, включая описание и ссылки. Неиспользуемый import/локальные переменные удалены. contentGrid теперь одна колонка minmax(0,1fr): предложения занимают всю ширину контентного контейнера. Собранные описания/источники сохранены в файлах. БД/API не менялись. Tests/build/browser/commit/push NOT_RUN по указанию владельца. Canonical main646dab5, прежний WIP сохранён.

## 2026-09-30: быстрые действия и единый выбор поставщика
По принятому пользователем направлению Kaspi comparison реализованы действия В корзину (lazy modal выбора актуального предложения) и Подробнее в CompactProductCard. Кнопки вне ссылки карточки, возврат focus при закрытии. Quick modal грузит comparePublicOffers только при открытии с текущим городом; loading/error/retry/empty, stale response guard. На ProductPage удалён дублирующий display-only список и modal trigger; общий SupplierOffers прямо в full-width панели. Строка: поставщик/подтверждённые маркеры, фасовка/min/orderIncrement, существующая доставка, цены за продажу/базовую единицу, количество и cart action. Общая логика cart использует типизированный API; ref lock против двойного клика, safe feedback, matching currency cart. Сверху краткое researched описание и минимальная доступная цена (BigInt, одна валюта), anchor Выбрать поставщика; служебные facts удалены. Future carriers/installments не симулируются: delivery block пригоден для расширения, не добавлены фиктивные способы оплаты/кредита. Старый product-offer-actions файл больше не импортируется ProductPage, оставлен без массовой чистки. Tests/build/browser NOT_RUN по запрету владельца; cart mutations не выполнялись, runtime acceptance pending. API/DB/контракты не менялись. No commit/push, canonical main646dab5. Agency frontend практики reuse/shared component/a11y применены.

## 2026-09-30: повторный запрос push всех изменений — BLOCKED

Основание: владелец поручил push всего текущего набора; последнее предложение
по предложениям поставщиков отложено и не реализуется. Проверены canonical root,
main/HEAD646dab585eda96bb21c994b92c611fbf13e56179, origin PlatformaMarket;
основная задача PlatformaMarket idle, активен только PlatformaMarket UI.
Актуальный WIP включает также DEV-RECOVERY и WORKSPACE-REBUILD. Их checkpoint
и outputs/workspace-rebuild-unit.log подтверждают npm test FAIL11/12:
compact-catalog.test.tsx не собирается из-за отсутствующего named export
createTabster в tabster. Совокупный лимит3 попытки исчерпан; новых запусков нет.
Прежний unit PASS от29.09 не сертифицирует изменившийся набор. Последний
workspace sidebar checkpoint сообщает typecheck PASS13/13; здесь не повторялся.
Свежий git diff --check PASS для tracked diff. Полный review/staged check,
остальные runtime/DB/browser gates не завершены. Применена прочитанная практика
Agency Git Workflow Master: проверка Git identity, состава и evidence до staging.
По AGENTS7.1/8 и Workflow5.1 staging/commit/push не выполнялись; CI NOT_RUN.
Все локальные изменения сохранены, приложение/БД/процессы не менялись.
Следующий шаг: устранить Tabster/Vitest import blocker отдельным ограниченным
исправлением, затем завершить обязательные проверки всего публикуемого набора.
Разрешение на push остаётся действующим; повторное разрешение на сам push
после успешной приёмки не требуется.

## 2026-09-30: одна подпись профиля в каталоге
По новому запросу UI-полировки удалены дублирующая подпись Личный кабинет
и подстрока роли из summary HeaderAccount. Остались имя организации и Fluent
chevron; существующее раскрытие меню, guest Войти и авторизация сохранены.
На ширине <=1100 имя больше не скрывается; длинное имя сокращается в доступной
ширине. Текущий E2E selector обновлён, добавлена проверка единственной подписи.
Предложения о новых shortcut links и корзине — только рекомендации, не реализация.
Scope: header-account.tsx, header.module.css, marketplace-header.spec.ts.
Применена прочитанная Agency Frontend Developer практика существующего shared
компонента/адаптивности/семантики. main646dab5, основная задача idle, чужой WIP
сохранён. git diff --check PASS. npm test не повторялся: неизменённый Tabster
blocker уже исчерпал3 попытки. Browser/build не запускались: это локальная
правка подписи, полная приёмка остаётся blocked прежним unit gate. Нет commit/push.
npm run typecheck PASS13/13 (10cached), session36768, после текущей правки.

## 2026-09-30: название организации открывает кабинет напрямую
Явное решение владельца отменяет предложенное меню: HeaderAccount теперь
обычная ссылка с названием организации, без details/chevron/logout/переключателя.
Назначение сохранено от прежней ссылки Открыть личный кабинет: BUYER workspacePath
с catalog query, SUPPLIER supplierAppUrl (unified launcher задаёт /supplier).
Guest Войти и проверка сессии сохранены. Удалена только ставшая ненужной логика
этого меню; auth API/рабочие данные не менялись. Добавлены min44px/focus-compatible
стили ссылки и обновлена существующая E2E проверка подписи/href.
Практики: ранее прочитанный Agency Frontend Developer, существующие компоненты,
адаптивность и семантическая ссылка. Canonical main646dab5, primary idle.
Проверки: npm run typecheck PASS13/13 (session9261); git diff --check PASS.
Полный npm test NOT_RUN: прежний Tabster blocker3/3 не затронут. Browser/build
NOT_RUN; runtime acceptance не объявляется PASS. Commit/push не выполнялись
из-за общего обязательного unit blocker, весь другой WIP сохранён.

## 30.09.2026: публикация через основной PlatformaMarket

Владелец повторно поручил push изменений обоих чатов. Основной primary принял
весь продуктовый WIP, сохранив эту историю. Tabster blocker устранён в A18;
последующие полный unit12/12/typecheck13/13 и canonical build PASS включают
текущую реализацию ссылки HeaderAccount. Публикация и actual CI ведутся в
[общем checkpoint](WORKSPACE-AUDIT-REMEDIATION-2026-09-30.md).
