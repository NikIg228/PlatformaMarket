# Выход клиники из каталога

Scope: запрос владельца29.09 — нельзя выйти из тестовой клиники. Canonical
main646dab5, primary writer; прежний WIP сохранён, сторонние данные не меняем.
Это отдельный дефект от пустого каталога: read-only диагностика выявила
приостановку500 demo offers по inventory freshness; восстановление не разрешено
и не выполнялось. Цены/остатки/публикации не изменялись этим исправлением.

Причины logout: в HeaderAccount не было действия выхода; кабинет отзывал
workspace bearer, но primary login cookie мог снова открыть кабинет.
Добавлена кнопка для клиники с pending/error. Прежний useSessionLogout
сохраняет server-confirmation и защиту от повторных кликов/смены sessionId.
Перед отзывом BUYER-сессии завершение primary login через существующие
GET auth/current и POST auth/logout с CSRF + bearer подтверждённого пользователя.
API/схема/permissions не менялись. При ошибке не показываем успешный выход.

DoD: типы, unit, browser password→documents→catalog logout→reload→login,
auth/current=null; diff check. Fixtures только disposable audit DB.
Gates attempt1: logout-types1.log, logout-unit1.log (concurrency1),
logout-browser1.log в outputs/unified-application-20260928; результаты pending.
Dev session39012 сохраняется. Не запускаем прежнюю очередь migration/payments
или публикацию смешанного WIP. Общий publication blocker остаётся отдельным.

Итог: локальное исправление проверено. Types1/2 PASS13/13 (вторая после
исправления legacy redirects), unit1 PASS12/12, git diff --check PASS.
Browser1 FAIL: GET /documents выдавал абсолютный redirect на localhost,
а тест возвращался на127.0.0.1 без host cookies. В обоих legacy GET handlers
Location теперь относительный, добавлен assert origin. Browser2 FAIL до logout:
GET auth/current500, trace + dev log подтверждают ECONNREFUSED4012 во время
Nest watch rebuild общих schemas при typecheck. После завершения types2 и
health200 browser3 отдельно PASS1/1 (9.8s). Таймауты/assertions не ослаблялись.
Доказано: пароль→workspace→cookie restore→меню клиники Выйти→гостевой header,
reload остаётся гостем, /login не выполняет автологин, auth/current=null.

Кнопка добавлена для клиники; поведение выхода поставщика не расширялось.
Изменены HeaderAccount, buyer workspace logout + отдельный primary helper/test,
legacy GET redirects и scoped regression. Использованы практики frontend reuse,
серверное подтверждение/CSRF, Playwright trace для причины провала.
Full build не запускался: frontend/auth glue + два GET redirects, TS/unit и
живой browser scenario покрывают scoped риск, dev сохранён для владельца.
Commit/push не выполнены: эти файлы зависят от ранее неопубликованного unified
и UI WIP с общим publication blocker; чужой scope не включён в коммит.
