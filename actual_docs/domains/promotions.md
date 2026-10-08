# Акции поставщиков

Обновлено: 08.10.2026. Приёмка связана с R2/R4/R7
[roadmap](../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md).

## Модель и сценарий

Акции входят в состав запуска. Есть скидки и параметризованное N+M.
На предложение действует одна акция без суммирования; разные строки могут иметь
разные акции. Поставщик задаёт условия, оператор модерирует, клиника видит
цену/подарок/срок и получает согласованный снимок в заказе.

Подарки резервируются с платными товарами. Разделение доставки не отменяет подарок.
При нехватке нельзя молча удалить подарок или повысить цену; требуется сохранить
обещание либо согласовать изменение/отмену.

## Версии и возвраты

Акция сохраняет исходную цену; модератор видит историю и минимум за30 дней
или фактически доступный меньший период. Это внутреннее продуктовое правило.
Смена цены/срока/подарка требует новой версии и модерации; обычная цена во время
акции заблокирована. Уменьшение количества до оплаты пересчитывает подарок
с подтверждением клиники. После получения возврат согласуется отдельно без
автоматического удержания стоимости подарка.

## Демонстрационная лента каталога — 09.10.2026

Новое решение владельца09.10 отменяет предыдущую прокрутку: статичный блок,
пять квадратов152×152 desktop (вдвое меньше304), без служебной подписи;
ссылка «Все акции» через dmLinkButtonProps secondary/default44px справа.
На mobile390 — статичная сетка3колонки/2ряда, без horizontal overflow.
Содержимое /promotions очищается до новой реализации, shared header сохраняется.
Это новый scope; прежняя проверка конца прокрутки ниже больше не применима.
Исполнитель тот же, primary idle проверен; исходный cb6de3b и собственный WIP9.
Риск: потеря доступности ссылки/overflow/излишняя высота первого экрана.
Новые gates: desktop/mobile screenshot+computed styles+keyboard link и пустой
/promotions; buyer/web types, scoped ESLint, UI contract, web build go_live,
diff/staged review, scoped publication. DB/API не меняются.

Паспорт референса: публичный каталог, viewport1440×900 CSSpx/100%; screenshot
владельца codex-clipboard-7009daf1-0d50-4745-be0e-fcfd8085463e.png — исходная
композиция. Контракты market-components-v1/platforma-semantic-light-v1.
Сохраняются белый header64px/логотип/кабинет, фон#F6F8F7 с существующим mint,
поля44px/radius8, Section radius12, Manrope14/16/18px, primary#007A59,
текст#17201E, граница#D7E1DC; внешние отступы24, padding16, gap12/24.
Меняется только compact promo:152px квадраты, пять слева, общая кнопка справа.
Фильтры и пятиколоночный каталог остаются; цены не выдумываются.
Сгенерировать один preview первого экрана, без browser chrome/новых функций/
служебных подписей, сверить композицию. Raster не заменяет browser evidence.
Новая редакция: browser PASS desktop1440×900/mobile390×844. Desktop152px,
секция185.6px, grid808px без overflow; mobile~96.5px,3колонки/2ряда,
все5изображений loaded, overflow страницы отсутствует. Shared link44px/radius8,
Tab focus green; Enter открывает /promotions, main пустой (0children/пустой text).
Скриншоты просмотрены. Генерация первого экрана сверена с runtime; первый
вариант отклонён за увеличение промо, уточнённая версия сохраняет малые карточки
и исходную оболочку. Raster — иллюстрация, точные значения доказаны браузером.
Types buyer/web, scoped ESLint, UI contract345 PASS; логи `.tmp/compact-promo-*`.
Web build go_live PASS1 (`.tmp/compact-promo-build.log`), diff review PASS.
Опубликовано: `9febd70f8f93db386ff3e70450aac99b636a4fae`, origin/main SHA совпал.
[CI37837003982](https://github.com/NikIg228/PlatformaMarket/actions/runs/37837003982)
и [Security37837003960](https://github.com/NikIg228/PlatformaMarket/actions/runs/37837003960)
на момент проверки IN_PROGRESS, не PASS. Canonical npm run dev восстановлен
(wrapper2364), /catalog HTTP200 и launcher readiness PASS, каталог сохранён.
Финальная запись docs-only переиспользует эти gates без повторения сборки.
Прежний scroll blocker ниже относится к отменённой
владельцем реализации, новый статичный scope принят отдельно по проверкам выше.

По отдельному запросу владельца исполнитель PlatformaMarket UI размещает пять
сгенерированных квадратных карточек в существующем блоке каталога; primary idle,
исходный main `cb6de3b`, рабочее дерево чистое. Это локальный визуальный preview
в development, без записей акций в БД и без изменения production-витрины.
План проверки: риск ограничен загрузкой изображений, горизонтальным overflow и
keyboard scrolling. Сохраняются Section и общие tokens; карточки304px, на узком
экране240px, gap16px, radius12px. Проверить desktop/mobile, пять загруженных
изображений, прокрутку/focus, отсутствие overflow страницы; buyer/web types,
scoped ESLint, UI contract, web build go_live и diff hygiene при завершении.
Проверки: buyer/web typecheck, scoped ESLint, verify:ui-contract345 и web build
go_live — PASS с первой попытки; diff hygiene PASS. В браузере все пять WebP
загружены, desktop304×304 / mobile240×240, gap16/radius12; overflow только
внутри ленты, keyboard focus наследуется от shared слоя, ArrowRight прокручивает.
Скриншоты обоих размеров просмотрены. Build log: `.tmp/promotion-preview-build.log`.
Карточки — изображения с альтернативным текстом, без фиктивных действий покупки.
Это частный R7 preview, не приёмка домена акций.

Итог: LOCAL_IMPLEMENTED / FINAL_BROWSER_CHECK_BLOCKED, без commit/push.
Dev восстановлен обычным npm run dev из canonical root: wrapper4092,
launcher9924, API16056; каталог HTTP200, пять карточек видны в DOM.
Readiness probe1 истёк во время штатного startup; probe2 HTTP200.
Дополнительная проверка достижения конца ленты не завершена: три ошибки
браузерного инструмента (первая при остановленном dev, затем selector deadlines
после восстановления, несмотря на наличие region в свежем DOM). Это не
доказательство дефекта приложения; исходные desktop/mobile/ArrowRight PASS
сохраняются, но финальная дополнительная проверка BLOCKED по AGENTS7.1.
Viewport возвращён к обычному; вкладка оставлена для владельца. Следующий шаг
после разрешения нового цикла: проверить конец ленты штатной прокруткой браузера,
без повторения types/build; затем scoped review/commit/push/CI receipt.

## Готовность и источники

Внутренняя основа есть; profile composition и реальная операционная приёмка
проверяются отдельно. Контракт должен быть связан с checkout, остатком, возвратами
и комиссией; UI показывает существенный diff и понятные ошибки.
Рекомендации, платные подписки и реклама/платное продвижение —
**планируется реализация в будущем**, вне пилота; акции не означают их включение.

[Product overview](../PROJECT_OVERVIEW.md#акции),
[shared promotion workspace](../../packages/ui/src/promotion-workspace.tsx),
[заказы](orders.md), [комиссия](commissions.md), [каталог](catalog.md).
