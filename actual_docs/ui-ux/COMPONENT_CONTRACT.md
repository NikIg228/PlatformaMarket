# Контракт компонентов Market v1

Решение владельца06.10.2026. Применяется к существующим и новым web UI изменениям.
Цвета: [semantic light v1](SHARED_SEMANTIC_THEME.md); геометрия:
[`component-contract.json`](../../packages/ui/src/component-contract.json).
Это дополнение к [UI стандарту](UI_UX_IMPLEMENTATION_STANDARD.md), не отдельная
дизайн-система. Fluent сохраняет доступность, portal, keyboard и form semantics.

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
