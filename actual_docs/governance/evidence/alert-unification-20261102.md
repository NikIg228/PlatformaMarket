# ALERT-UNIFICATION-20261102

Поручение владельца: единая стилистика toast/inline/note, AuthNotice и прямых
MessageBar; сверка локальных сообщений, mobile/dialog/keyboard и устранение
двойного offline-сообщения. Scope — Market, без переноса в CRM и без backend/DB.
База eb09a034; чужой personal-cart/auth WIP и checkpoint сохраняются.

План до реализации: общая поверхность уведомления с семантической иконкой,
Manrope, заголовком14/600, пояснением12/1.5, radius12, padding16, gap12;
существующие semantic-light.json и component-contract.json без смены tokens.
Уточнение владельца во время работы: все notification cards повторяют верхнюю
жёлтую карточку эталона: solid semantic fill, overlay shadow, title/body14px.
Это заменяет первоначальный план soft inline/transparent note и прежний note-контракт.
Analogue: packages/ui/src/primitives.tsx DmFeedback и save-toast.tsx.
Сеть — одна постоянная карточка до подтверждённого recovery, затем короткий
success; ошибки полей и recovery controls остаются у действия.

Риск: shared consumers, modal announcements/focus, deduplication/timers и reflow.
Focused checks: UI rendering/connection tests, auth/order consumers; browser
desktop1440/mobile390, network offline/checking/unavailable/recovered, toast
replacement/expiry, dialog keyboard/return focus, auth inline and field errors.
Completion: affected workspace types, scoped lint, UI contract, unified web build,
diff hygiene, screenshots/computed styles. DB/full release suites не требуются.
## Результат и проверки

Общая FeedbackSurface используется в DmFeedback, toast, fallback ActionFeedback
и inline ErrorState. Убраны отдельный AuthNotice CSS и прямой MessageBar.
Переведены page/action сообщения catalog/header/cart, orders, supplier import,
VAT/settings, buyer services и operator trust/secret. Ошибки конкретного поля,
фильтра дат/цены, consent и файла, бизнес-статусы/freshness сохранены по месту.
Сеть использует одну solid-card без компактного дубля, не скрывает её по таймеру;
ручное закрытие до смены состояния, health-confirmed recovery и focus в modal.
Catalog initial/more failure имеет одну постоянную карточку с retry и не теряет
товары. Auth сохраняет requestId и recovery link; черновики не сбрасываются.

PASS: UI owning suite20files/94tests, buyer decision/profile2files/6tests;
focused notification2 + index/connection7. Типы ui/buyer/supplier/admin/landing/
web/e2e PASS. Unified web build PASS (webpack,50 static pages), scoped ESLint
и UI contract PASS (470files,10024 declarations). После изменения только тестовой
фикстуры повторены e2e/buyer types и lint затронутых тестов.

Browser notifications6 PASS: desktop1440/mobile390, replacement/reset timer,
expiry, сохранение ввода и recovery, dialog keyboard/return focus, auth field
validation/inline error, offline/unavailable/verified recovery без дублирования.
Production consumer matrix6 cases закрыта:4 PASS в attempt1, catalog PASS в
attempt2, clinic mobile PASS в attempt3. Неизменённые PASS переиспользованы.
В CI добавлены оба targeted browser набора с управляемым cleanup процессов,
без реального API/DB; fixtures только localhost synthetic.

История: первый новый unit import упёрся в tabster ESM во внебраузерном runner;
Fluent-specific поведение проверено браузером, pure surface отдельно — PASS.
Lint отклонил native button в новом unit input — заменён неинтерактивным action
slot; повтор PASS. Browser consumer attempt1: frozen clock оставлял toast над
submit — тест теперь явно закрывает карточку перед retry; stale heading locator
заменён фактическим toast. Attempt2: чужой personal-cart WIP запросил новый
GET /auth/personal-current; fixture явно возвращает null без изменения guards.
Attempt3 PASS. Failed artifacts сохранены отдельно; force click/skip не применялись.

Снимки: output/playwright/notification-unification/ (6 browser cases),
output/playwright/notification-consumers[-attempt2/-attempt3]/ (consumer evidence).
Итоговый production CUA screenshot:
output/playwright/market-alerts-unified-20261102/after-desktop.jpg.
computed-styles.json там же: обе карточки Manrope, title/body14, radius12,
padding16, gap12, shadow0/12/28/16%; warning#F4C542/#17201E, error#A33B35/#FFFFFF.
Images просмотрены: desktop modal toast выше backdrop, mobile auth/reflow без
overflow. NVDA/JAWS и production deployment не проверялись.

Применены Development Toolkit, checklist Frontend Developer (shared architecture,
responsive/a11y/state preservation) и Code Reviewer (contracts, races/focus,
scope и test evidence), без делегирования. Серверы тестов и CUA остановлены,
offline/reduced-motion override сняты; next-env восстановлен после generated build.
Backend, рабочие данные и CRM не менялись. Чужой personal-cart/auth WIP и docs
commit2310c91 сохранены. Scoped staging/публикация и CI подтверждаются отдельно.
