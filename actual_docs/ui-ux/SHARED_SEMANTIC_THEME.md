# Общая тема — переход и историческое evidence

Действующие роли, состояния и light-only режим определяет
[единая дизайн-система](DESIGN_SYSTEM.md). Значения цветов:
[semantic-light.json](../../packages/ui/src/semantic-light.json).
Этот адрес сохранён для совместимости; новые нормативные правила здесь не добавляются.

Ниже сохранён аудит02.10.2026 на тогдашних inputs. Упоминания dark preference,
отсутствия потребителей и покрытых маршрутов — исторические наблюдения,
не описание текущего runtime и не актуальная сертификация.
[Исходное evidence](../governance/task-state/SHARED-THEME-2026-10-02.md).

## Итоговый аудит потребителей

Аудит выполнен тем же исполнителем по дополнению владельца02.10, без новых агентов.
Статический маршрут: shared provider/CSS, все CSS/TSX потребители в apps/web,
buyer-web, supplier-web, admin-web и landing-web; inline style/fill/stroke,
локальные CSS overrides и их imports. Это не означает browser-проверку каждой
комбинации данных или каждого разрешения.

| Поверхность | Статическая проверка | Browser / computed evidence |
| --- | --- | --- |
| Header/catalog/filter dialog | brand, neutral, selected, input/checkbox, focus, disabled | 390/1440; primary default/hover/pressed, checkbox, focus/restore, overflow, screenshots |
| Supplier comparison | DmButton, amount field, feedback | 390/1440; disabled colors, held loading, blocked duplicate write, error/retry, preserved quantity |
| Login | DmInput/DmButton, scoped auth CSS, pending/error | 390/1440; field border/focus/disabled, primary/pending colors, held request, error color, preserved input, screenshots |
| Register | role/consent/select, form overrides | 390/1440; selected role/primary computed colors, overflow/screenshots; no account creation in theme audit |
| Admin login | shared form tokens, decorative gradients | 390/1440; sign-in card/unavailable-provider notice, overflow/screenshots; local operator form unavailable in pilot fixture, MFA/network identity not retested |
| About / suppliers public | text/surfaces/actions, preserved geometry/assets | 390/1440; rendered routes, overflow/screenshots |
| Clinic/supplier workspace | sidebar/header, shared forms/dialogs/tables | existing canonical flows; supplier selected sidebar computed colors, mobile menu/keyboard dismissal/screenshots |
| Admin operations | all module CSS; danger action separates enabled/disabled | existing admin flow smoke; danger pressed/disabled only static, no destructive action invoked |
| Fluent theme | real createLightTheme contrast regression, CSS/JSON values | checkbox/fields + real route controls; stored dark-mode theme variable |
| Switch/TabList/Tab / AI | no current Fluent Switch/TabList/Tab consumers found; document/category selectors use buttons with aria-pressed; AI purple roles reserved in v1 | native selector states use shared adapters; no synthetic product page added just to demonstrate unused controls/AI |

Исправлены обратный Fluent ramp, старые public/auth цвета, полупрозрачный
disabled, overrides ошибок/selected, danger hover/pressed, недостаточная граница
select/combobox, потеря keyboard modality при перехвате Tab focus-trap и
StatusTag tone (Fluent Tag не обрабатывает переданный color как semantic status;
теперь используются существующие mp-status-* классы с явными ролями).

Обоснованные исключения: изображения товаров/фотографии/логотипы и их SVG
не перекрашиваются; сохранены logo mark styles, брендовые OAuth-кнопки,
декоративные градиенты/тени/полупрозрачные scrims. Белый `#fff`/`white` для
inverse равен утверждённому значению. В старых декоративных/catalog styles
сохранены художественные градиенты: это не интерактивный state contract.
Варианты после успешных внешних OAuth/MFA/почтовых действий не проверялись:
внешние действия и рабочие данные вне поручения. Dark-mode persistence проверен,
но полная dark visual/contrast сертификация не заявляется.
