# ADR 015: единое frontend-приложение

Статус: решение для реализации локальной миграции, 28.09.2026.
Основание: явное поручение владельца после UNIFIED-APPLICATION-PLAN §9.
Production-переключение не разрешено; push отложен владельцем.

## Границы

Один Next.js `apps/web`, публичные routes и отдельные layouts /clinic,
/supplier, /admin. Nest остаётся владельцем бизнес-логики и авторизации.
Четыре прежних frontend процесса не нужны новому runtime. Первоначально
route adapters используют существующие feature modules без копирования;
источники в старых apps не означают четыре web-сборки. Старый запуск сохраняется
для отката до приёмки. Генерируемые public assets собираются из исходных public
каталогов с обнаружением конфликтов; исходные изображения не дублируем вручную.

ADR010 заменяется только в числе frontend артефактов: профиль pilot/go_live,
build-time consistency и серверные границы сохраняются. ADR014 заменяется
в части междоменной навигации: новый UI использует один origin. Его scoped
BUYER/SUPPLIER sessions, HttpOnly cookies, CSRF/refresh/revocation и серверная
проверка membership сохраняются на первом этапе совместимости. Это не новая
универсальная роль и не слияние разрешений разных организаций. Операторская
сессия остаётся отдельной привилегированной областью с существующим MFA.
Рекомендация единой identity не разрешает ослаблять серверные проверки ради
одного cookie. Полная замена session API требует отдельного контрактного этапа.

Публичный layout не оборачивается в клинический OrganizationGate. Клинические
закрытые страницы используют прежний gate; auth/public/supplier/admin имеют
свои контексты. Навигация между кабинетами с полной загрузкой очищает React
state предыдущей области; session/organization проверяются сервером до данных.
Не переносить access/refresh tokens в URL. Handoff codes сохраняются как
одноразовый совместимый переход, пока существуют старые потребители.

## Адреса и proxy

| Старый источник/путь | Новый путь | Проверка доступа / приёмки |
| --- | --- | --- |
| buyer /, /catalog | /, /catalog | Публичный каталог; URL/count/back |
| buyer /products/[id], /about, /suppliers | те же пути | Публичные данные/изображения |
| buyer личный кабинет / | /clinic | BUYER session + org gate |
| buyer /documents, /orders/[id] | /clinic/documents, /clinic/orders/[id] | Те же permission/tenant checks |
| supplier /, /documents, /orders/[id], /legal/[code] | /supplier, /supplier/documents, /supplier/orders/[id], /supplier/legal/[code] | SUPPLIER session/admission |
| admin /, /login | /admin, /admin/login | Operator permissions/MFA |
| landing /login, /register, /register/resume, /verify-email, /reset-password, /legal/* | те же пути | Прежние auth contracts/return validation |
| buyer /catalog-search, /catalog-fallback | те же handlers | Прежние server-only upstreams |
| browser /api/* | fixed INTERNAL_API_URL | Без client-selectable upstream |

Общие функции строят кабинетные ссылки; прямой URL не выдаёт полномочий.
Next rewrites обслуживают фиксированный API upstream и в dev, и в production
build. Host/Origin/CORS конфигурация должна соответствовать единому адресу;
cookies, streaming и downloads проверяются отдельно. CSP nonce общий,
auth-provider sources разрешены только auth routes; приватные ответы no-store.
В production остаётся отдельная проверка ingress/HTTPS и выбор origin оператора.

## Откат и ограничения

До локальной приёмки основной запуск не переключать без готового fallback.
Явный legacy launcher восстанавливает прежние порты/сборки, без отката БД.
Cookies разных origins не переносим: при смене адреса допустим повторный вход.
Старые GET URL обслуживаются по явной карте; writes не перенаправляются.
Production домен, срок старых ссылок, ресурсы/SLO и operator origin остаются
нерешёнными вопросами плана. Локальное доказательство не означает go-live.
