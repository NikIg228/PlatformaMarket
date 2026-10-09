# CONTROL-STATES — общие состояния элементов управления

09.10.2026. LOCAL_PASS / PUBLISHED / CI_PENDING. Исполнитель UI: `01a11795-17a2-7f52-9e7d-b3314bf87ed7`.

Код `28bb54df3b8756e5e9e5e8db8159c28ea9075c32` опубликован в origin/main;
независимый ls-remote подтвердил SHA. Exact-SHA snapshot после push:
[CI37955317246](https://github.com/NikIg228/PlatformaMarket/actions/runs/37955317246)
и [Security37955317309](https://github.com/NikIg228/PlatformaMarket/actions/runs/37955317309)
QUEUED. CI_PASS не заявляется. Это receipt локально принятого изменения,
не новая фаза и не автоматический монитор CI.
Владелец явно поручил распространить согласованный результат анализа каталога
на подобные компоненты во всём проекте. Primary проверен idle/completed;
новые исполнители не запускаются, реестр владения не переносится.

Baseline main `85a80758e8a56c44a83e063cfb258ffd3141a80f`; canonical root,
dirty только прежний `output/imagegen/catalog-product-reference-2026-10-09/`.
Scope R7.1: shared neutral buttons/link buttons, inputs/selectors, native
actions и city disclosure; удалить конфликтующие локальные состояния consumers.
API, данные, бизнес-поведение, геометрия страниц и семантика primary/danger сохраняются.

Паспорт: component-contract market-components-v1, semantic-light-v1; Manrope,
body14, controls44/compact32, radius8. Сверка каталога1486×1077/100% выполнена
перед задачей: search/category border#83988D, city/filter#D7E1DC; hover различается.
Новый owner-approved контракт: нейтральная светлая заливка surface.subtle,
hover surface.hover, pressed/open/selected brand.soft; прозрачная граница,
без translate при нажатии. Keyboard ring1px/offset2 сохраняется;
invalid красная рамка + сообщение, disabled/read-only не реагируют на hover.
Primary/danger сохраняют семантические заливки. Палитра не расширяется.

Риски: каскад Fluent/local CSS, selected/open, потеря доступного focus,
disabled/error и наследование в кабинетах/порталах. Проверки: UI contract/theme
unit и guard, targeted browser UI kit + catalog + representative supplier/admin/
clinic forms, desktop1440/390, computed styles/screenshots/keyboard/forced colors.
Completion: affected UI/web/buyer/supplier/admin/landing/e2e types, scoped lint,
unified go_live web build с остановкой собственного dev на время сборки; diff/review, scoped commit/push,
remote SHA и фактический CI status. Не запускать DB/full E2E/release gates.
Максимум3 попытки на gate; PASS повторяется только при изменении его входов.

## Результат и evidence

- Общие Input/Textarea/Select/Dropdown/Combobox, Button/link-button, Action,
  file picker и composer переведены на заливки. `outline` — совместимый API alias
  нейтрального варианта. City trigger использует общий DmDisclosureSummary.
- Удалены конфликтующие локальные состояния поиска/города/категорий, выбора роли,
  действий товаров, рекомендаций, модулей/подключений оператора, механик акций,
  импорта и списка поддержки. Выбор подключений/рекомендаций отражён aria-pressed.
  Feature CSS сохраняет композицию; размеры обычных controls44/32 и radius8 сохранены.
- `npm run test --workspace=@marketplace/ui -- component-contract.test.ts light-theme.test.ts`:
  PASS5. Последние CSS правки не меняют проверяемые token values/references.
- `npm run typecheck --workspace=@marketplace/ui --workspace=@marketplace/buyer-web --workspace=@marketplace/supplier-web --workspace=@marketplace/admin-web --workspace=@marketplace/landing-web --workspace=@marketplace/web --workspace=@marketplace/e2e`: PASS.
- Scoped ESLint PASS; `npm run verify:ui-contract`: PASS348 files +4 policy tests.
- Browser23 unique cases PASS (mock/read-only; без записи в рабочую БД):
  `playwright.ui-contract.config.ts` —11, shared theme auth audit —2;
  `playwright.workspaces.config.ts --grep 'catalog reference layout|profile-edit clinic layout|documents registry clinic layout|compact list filters and offer drawer'` —8;
  `playwright.support.config.ts --grep 'support first request validation'` —2.
  Последние изменения invalid/readonly/composer дополнительно подтверждены
  neutral-state2 и support2. Desktop1440/mobile390, open/selected, keyboard,
  disabled/error, forced colors, draft/retry проверены; primary/danger сохранены.
- История запусков: catalog run1 FAIL2 — тест ожидал Tab-контур после мыши/Escape;
  исправлен на Tab/Shift+Tab → Enter → Escape, run2 PASS2 без изменения runtime.
  Auth run1: desktop PASS, mobile FAIL — заполнение SSR поля до hydration,
  email пуст к submit. Введено ожидание существующего client input-modality marker
  и assertion сохранности email; mobile run2 PASS. Assertions не ослаблены.
- Screenshot/computed styles: `output/playwright/control-states*`; просмотрены
  UI kit, каталог1440/390, supplier products, register и representative consumers.
  Проверены реальные CSS-состояния и отсутствие overflow, не только token names.
- `$env:DEPLOYMENT_PROFILE='go_live'; npm run build --workspace=@marketplace/web`:
  attempt1 PASS; `.tmp/control-states-build.log`. Собственный dev17812 остановлен
  перед сборкой; восстановление canonical `npm run dev` — wrapper296.
- Применены development-toolkit/frontend/verification, web-interface-guidelines,
  практики Agency Frontend Developer и Code Reviewer: семантика, состояние,
  accessibility, каскад, review API совместимости и проверка outgoing scope.
  Агентов не создавали. Backend/full release/DB suites неприменимы к этому scope.

Canonical dev восстановлен: /catalog и API /health/ready HTTP200, JWT/go_live.
Diff hygiene, Markdown links и review собственного scope PASS; fetch origin/main
подтвердил 0/0 divergence перед staging. Next generated next-env вернулся к dev baseline.
Staged review и публикация выполнены; прежний untracked imagegen output сохранён.
Локальный результат доступен владельцу для просмотра; CI остаётся pending.
Общий R7 остаётся открытым. Новые изменения автоматически не запускаются.
