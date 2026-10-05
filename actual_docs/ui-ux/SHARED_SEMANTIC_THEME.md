# Общий светлый контракт Platforma

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

Существующий `webDarkTheme` и выбор `marketplace-theme` сохранены; эта версия
не вводит общий dark contract. Новая dark-палитра требует отдельной задачи.

Проверки: [checkpoint и evidence](../governance/task-state/SHARED-THEME-2026-10-02.md).
Unit regression проверяет реальные значения Fluent, затемнение primary,
AA text/feedback, границы полей/focus и соответствие CSS утверждённым значениям.
Browser regression использует реальные компоненты каталога при 390/1440px:
hover/pressed, checkbox, keyboard focus, disabled/loading и запрет повторной записи.

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
