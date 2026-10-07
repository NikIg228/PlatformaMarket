# Дизайн-система PlatformaMarket — единый источник истины

Решение владельца07.10.2026. Единая точка входа для параметров компонентов,
дизайн-токенов и правил применения. Консолидация без изменения runtime и значений.

## Источники и приоритет

| Предмет | Авторитетный источник |
| --- | --- |
| Геометрия, типографика, отступы, тени | [component-contract.json](../../packages/ui/src/component-contract.json) |
| Семантические цвета | [semantic-light.json](../../packages/ui/src/semantic-light.json) |
| Применение компонентов и токенов | Этот документ |
| CSS и Fluent mapping | [styles.css](../../packages/ui/src/styles.css), [light-theme.ts](../../packages/ui/src/light-theme.ts) |
| Формы, сценарии, адаптивность, доступность | [UI/UX стандарт](UI_UX_IMPLEMENTATION_STANDARD.md) |
| Исторические проверки | [Аудит](COMPONENT_CONTRACT_AUDIT.md), [карточка](../governance/task-state/UI-CONTRACT-2026-10-06.md) |

Два JSON — непересекающиеся разделы одного контракта. Точные значения берутся
из них; таблицы ниже — справочное представление. CSS/Fluent реализуют контракт,
не задают альтернативные значения. Расхождение документа, JSON и runtime
нужно явно фиксировать и исправлять в разрешённом scope, не подгонять требования
под код. Последнее явное решение владельца определяет разрешённое изменение.
Исторический PASS не является приёмкой изменённой реализации.

## Геометрия и компоненты

| Элемент | Контракт |
| --- | --- |
| Кнопки и однострочные поля | min-height44px; radius8px |
| Компактные действия/поля | `density="compact"`,32px; прежний `size="small"` соответствует compact |
| Кнопка только с иконкой | квадрат44/32px; обязательное доступное название |
| Card / section / filters | radius12px; border/default и surface/default |
| Dialog | radius16px; shadow/overlay |
| Отступы | основная сетка4/8/12/16/24/32px;2px для micro,40–128px для крупных блоков |
| Типографика | Manrope; размеры10/12/14/16/18/20/24/28/32/40/48/56/64/80/96 через `--dm-font-size-*` |
| Focus | один внешний контур1px, offset2px; pointer без контура; ошибка сохраняет свою границу |

Высоты являются минимумом: длинный текст может переноситься. Textarea многострочный.
Для touch основным остаётся44px; compact предназначен для плотных desktop действий.
Нельзя обрезать focus через overflow на непосредственном контейнере управления.

## Использование

Базовые контролы импортировать из `@marketplace/ui/controls` или общего barrel.
Внутри packages/ui — из `./controls`, чтобы не создавать циклы через barrel.
Прямой импорт Button/Input/Textarea/Select/Field/Checkbox/Dropdown/Combobox из
Fluent запрещён ESLint вне адаптера. Другие Fluent primitives сохраняются.

```tsx
<DmButton appearance="primary">Сохранить</DmButton>
<DmButton>Отмена</DmButton>
<DmButton appearance="subtle" density="compact">Подробнее</DmButton>
<DmButton intent="danger">Удалить</DmButton>
<DmField label="Организация" required><DmInput name="company" required /></DmField>
<DmSurface variant="filters">{/* фильтры */}</DmSurface>
```

`DmFluentDropdown` и `DmCombobox` сохраняют полный Fluent API;
`DmDropdown` — адаптер существующего value/onChange с option children.
Новые селекторы используют их. `DmSelect` остаётся совместимым нативным
контролом для существующих форм: name, required, ref, selectOption и change
events не подменяются при стилевой миграции. Его системное меню не тематизируется.
Перевод такой формы на Dropdown требует отдельной проверки валидации/отправки.

Разметка карточек может сохраняться с существующим семантическим тегом;
радиус, фон и рамка используют общие tokens. `DmSurface` подходит для новых
карточек, секций и фильтров. Не заменять form/fieldset/table на div ради стиля.
Layout, ширина, responsive композиция принадлежат feature. Не переопределять
размер/radius/focus контрола локально: применять variant или расширять адаптер.
`DmAction` сохраняет нативную семантику кнопки для строк, navigation, tabs,
choice cards и текстовых действий. Его layout может зависеть от содержания;
геометрия обычных boxed buttons остаётся в `DmButton`. `DmFileInput` сохраняет
file/ref/reset/hidden semantics. `DmDismissLayer` предназначен только для backdrop.
Обычные HTML button/input/select/textarea вне адаптера запрещены ESLint.
Для Next Link с видом кнопки: `dmLinkButtonProps` из `@marketplace/ui/link-button`.
Обычные текстовые ссылки не становятся кнопками.

Многострочный composer — `DmSurface variant="composer"` с
`DmTextarea variant="composer"`: общий focus и error border на контейнере.
Горизонтальные Fluent TabList прокручиваются внутри доступной ширины.
Popup/menu option используют общий radius8 и minimum32; dialog —16.
Pill/circle допустимы для badges/avatar, нулевой radius — для стыков поверхностей.
Ширины колонок, изображения, положение, breakpoint и декоративная геометрия
остаются локальными. Отступы, шрифт, радиусы и цвет даже в них берутся из tokens.

## Тема и проверка

Поддерживается светлая тема с Manrope из корневого layout и системным fallback.
Системная тёмная тема и прежний marketplace-theme не включают неполную dark
палитру; сохранённая настройка не удаляется. Новый dark mode требует полного
контракта и проверки всех поверхностей.

Dev-only образцы: `/dev/ui-kit`; production возвращает404.
`npm run test --workspace @marketplace/ui -- component-contract.test.ts light-theme.test.ts`
проверяет синхронизацию tokens и отсутствие неизвестных `--dm-*` ссылок.
`npm run verify:ui-contract` проверяет CSS/TSX всех приложений и packages/ui:
неизвестные tokens, raw typography/spacing/radius/colours, локальный focus,
inline control styling и CSS overrides классов shared controls. `npm run lint`
включает этот guard и ESLint границы импортов/native controls. Gates входят в CI.
Целевая browser-проверка:
`npx --no-install playwright test --config apps/e2e/playwright.ui-contract.config.ts`
при работающем canonical dev. Проверяет формы, ссылки, focus, выбор, диалог,
состояния и отсутствие горизонтального overflow при1440/390px.

При shared изменениях проверить репрезентативные реальные consumers: документы,
каталог, поставщик; light/dark OS, keyboard, disabled/error, длинные подписи.
Изменение контракта требует обновить JSON, адаптер, документацию и затронутые
проверки. Не обновлять expected лишь ради зелёного теста.

Guard обнаруживает прямые классы CSS modules и Fluent selectors; динамические
className/сложные selectors требуют review. Он не доказывает итоговый cascade,
контраст, clipping или визуальное качество. Browser-проверка изменённой поверхности
обязательна. Исходники и representative runtime покрытие описаны в
[реестре аудита](COMPONENT_CONTRACT_AUDIT.md); они не равны приёмке всех бизнес-сценариев.

## Семантические цвета и состояния

05.10 PRODUCT-PAGES-REFINEMENT: `DmSearch` — общий поиск кабинетов клиники и
поставщика, включая каталог и документы. Размер440×44px, max-width100%; без
лупы и отдельной внешней кнопки. При непустом вводе внутри появляются очистка
и «Найти»; Enter применяет поиск, IME composition не отправляет его. Контекстный
placeholder начинается с «Найти». Combobox сохраняет подсказки и клавиатурный
выбор; очистка возвращает фокус полю. `pending` блокирует повторную отправку.

Версия `platforma-semantic-light-v1`, 02.10.2026. Утверждённые владельцем
значения CRM/Market сохранены в [semantic-light.json](../../packages/ui/src/semantic-light.json).
Этот JSON — контракт значений, а не новая библиотека компонентов.
Market применяет его через [Fluent adapter](../../packages/ui/src/light-theme.ts)
и существующие `--dm-*` переменные в [styles.css](../../packages/ui/src/styles.css).
Изменение общей палитры требует согласования новой версии обоими продуктами.

| Роль | Значение / поведение |
| --- | --- |
| Canvas / поверхность / subtle / hover | `#F6F8F7` / `#FFFFFF` / `#F0F4F2` / `#EAF0ED` |
| Primary default / hover / pressed | `#007A59` / `#00664B` / `#00543E`; белый текст, фон темнеет |
| Brand content / selected / border / accent | `#00543E` / `#E4F3ED` / `#B9DFCD` / `#4FD49A` |
| Текст primary / secondary / muted | `#17201E` / `#4F5E58` / `#607169` |
| Разделитель / граница поля | `#D7E1DC` / `#83988D` |
| Keyboard focus | `#007A59`, один индикатор1px; Tab/Shift+Tab и навигационные клавиши вне текстового редактора включают keyboard mode. Клик, набор, IME и движение курсора не создают дополнительную рамку |
| Disabled | фон `#EEF1EF`, текст `#728078`, граница `#D7E1DC`; без opacity на всей кнопке |
| Loading | существующий pending-text и disabled/lock; не допускает повторного действия |
| Success | `#237A4A` / `#EEF8F2` |
| Warning | `#9A5A13` / `#FFF5E8` |
| Danger | `#A33B35` / `#FFF0EE`; hover `#8F302B`, pressed `#762620` |
| Info | `#245E8A` / `#EDF5FF` |
| AI | `#6F4CC3` / `#F4F0FF`; hover `#5E3CAE` |

Success/warning/danger/info обозначают смысл обратной связи, AI — отдельную
фиолетовую роль. Не заменять их brand-зелёным. Accent не служит фоном primary
с белой надписью. Disabled-текст не является образцом для обычного текста.

Fluent ramp направлен от тёмного к светлому. Для primary/compound actions,
ссылок, полей, focus и disabled заданы явные semantic overrides. Выбранный
checkbox использует primary и белую отметку; выбранные строки/навигация — soft
фон и тёмный content. Шапка и текущий каталог используют те же CSS-переменные.
Геометрия, навигация, логотипы, permissions и бизнес-обработчики не меняются.

Уточнение05.10 SHARED-FOCUS: общий индикатор рисуется на оболочке Fluent,
внутренний input и собственный focus-псевдоэлемент не дублируют его. У обычных
полей линия совпадает с границей; у ошибочных полей красная граница и сообщение
сохраняются, тонкий Tab-индикатор вынесен наружу. Выбранное состояние checkbox,
обычные границы, focus target и обработчики клавиатуры не изменяются. В режиме
forced colors используется системный Highlight. После Tab обычный ввод сохраняет
keyboard mode до следующего pointerdown. CSS действует также на портальные controls.

Текущий provider поддерживает только light. Сохранённая настройка marketplace-theme
не удаляется, но не включает dark. Системная тема также не переключает палитру.
Новая dark-палитра требует отдельного полного контракта и проверки.


## Выбор типографики и перенос референса

Наличие токена в шкале не означает, что он подходит любому элементу.
Основной текст использует body, подписи — caption, подзаголовки — subtitle;
крупные page/display не назначаются автоматически карточкам кабинета.
Сначала проверить принятую иерархию изменяемой страницы. Manrope подключён
в [корневом layout](../../apps/web/app/layout.tsx), с системным fallback в CSS.

Локальный принятый пример Settings/Profile: subtitle для заголовков секций,
body для текста, space-6 для padding карточки и space-4 на mobile.
Это не поручение переделать остальные страницы. Размеры shell принадлежат
общей оболочке; картинка не переопределяет их молча.

Перед реализацией утверждённого референса записать viewport и масштаб,
ширину shell/контента, колонки, роли текста, размеры controls и отступы
с соответствующими токенами. Если картинка противоречит общему контракту,
обозначить расхождение и необходимое решение до изменения контракта.
Не переносить размеры растровой картинки без учёта масштаба.

При визуальной приёмке сопоставить референс и screenshot в одинаковом масштабе
и viewport: типографику, ширины, отступы, плотность, переносы, цвета и состояния.
Зафиксировать отклонения и исправления. Сохранение screenshot, отсутствие
overflow и успешный функциональный тест не доказывают соответствие «один в один».
Проверить затронутые mobile/keyboard состояния по UI/UX стандарту.

## Обновление источника истины

1. Определить роль и consumers; не добавлять локальный дубль токена.
2. Согласованно обновить соответствующий JSON и CSS/Fluent/adapter mapping.
3. Изменения применения описать здесь; UX сценарии — в UI/UX стандарте,
   evidence — в карточке задачи. Старые страницы перехода не расширять.
4. Выбрать проверки по [Workflow](../governance/DEVELOPMENT_WORKFLOW.md):
   runtime tokens требуют синхронизации и representative consumers;
   docs-only — ссылок, согласованности и diff hygiene без app/DB/browser suites.

Общая палитра CRM/Market сохраняет согласование новой версии обоими продуктами.
Этот документ не разрешает изменять другой репозиторий или редизайн вне задачи.
