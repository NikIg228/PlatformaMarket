# UNIFIED-APPLICATION — выполнение

Владелец: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1, canonical main646dab5.
28.09 владелец прямо возобновил реализацию единого frontend по плану.
Локальные проверки разрешены, push отложен до отдельного поручения.
UI writer01a0e834 подтвердил остановку и происхождение последних auth/city edits;
сохраняем весь текущий WIP. Других писателей нет, новых агентов не запускаем.

Статус active, этап0/1. Один Next web + прежний NestAPI/worker; публичные routes,
auth, /clinic, /supplier, /admin. Не реализуем отложенные оплаты/интеграции.
Источники: UNIFIED-APPLICATION-PLAN §1–9, ADR001/003/010/014, Product§22,
Workflow/context, UI standard. Agency Backend Architect/Frontend Developer:
границы/контракты, повторное использование компонентов, доступность/rollback.

Baseline: CATALOG-NAVIGATION types12/unit11/build8 browser5 локально PASS,
поздние auth/city cosmetics другого scope не проверены. HEAD не описывает WIP.
Исторические catalogue5/7/payment blockers не сбрасываем и не объявляем PASS.
Dev21184: старые4Next/API из canonical root, auditDB; не останавливать чужие.

Порядок: inventory/ADR → public skeleton → auth/clinic → supplier → admin →
launcher/build/CI inventory → local acceptance/rollback. Старый launcher оставить
явным legacy до доказанного переключения. Исходные feature modules временно
остаются в старых каталогах без дублирования; новый web компилирует их в один
артефакт и не зависит от старых HTTP-процессов. Перенос физических файлов —
после проверки эквивалентности, не смешивать его с изменением бизнес-правил.

Gates: types/unit/build нового web; browser routes/auth/tenant context/public
catalogue, ошибки API, proxy uploads/cookies; composition/runtime/config по
затронутому scope. Test DB только dentmarket_audit_20260914@127.0.0.1:5432.
До каждого запуска записывать команду/входы/профиль. Max3 на gate/blocker;
build/test20мин, scoped browser45мин, server5мин, diagnosis15мин.
No push. Не объявлять пилот/release принятыми без полного набора доказательств.

Этап0/1: карта routes/границ в ADR015, baseline hashes/diff в ignored outputs.
Каркас apps/web использует исходные feature modules, без четырёх HTTP upstreams.
Scoped auth CSS/public assets генерируются prepare-unified-web; package-lock
только новый workspace25строк. Единственное перемещение исходника: buyer page
→ buyer-workspace.tsx рядом; page.tsx сохраняет совместимую Next route signature.
Новые проверки пока0. Прежний dev21184 остановить штатно перед сборкой/запуском.
Локальные проверки разрешены новым ответом владельца; push отложен.

Обновление выполнения: единый runtime собран, public/auth/clinic/supplier/admin
route adapters используют прежние компоненты. Added clinic session boundary,
scoped links/return allowlist, no-index private layouts; GET legacy documents/orders
идут через подтверждение кабинета, POST не перенаправляется. npm dev/dev:pilot
переключены на unified; dev:legacy/build:legacy сохраняют старый вариант.
Docker web target добавлен без выпуска и изменения release matrix.

Evidence outputs/unified-application-20260928:
- web-build1 PASS4/4 2m27s; web-build2 PASS4/4 1m25s; web-build3 идёт после
  добавления legacy GET adapters (изменение входов, не повтор неизменного build).
- typecheck1/2 FAIL: повреждённые generated .next/dev/types старых landing/buyer;
  после typegen всех legacy + удаления только повреждённых generated files
  typecheck3 PASS13/13. Исходники/проверки типов не ослаблялись.
- unit1 FAIL: performance-boundary ещё читал перенесённый page вместо feature;
  путь исправлен, assertion24карточки сохранён. unit2 PASS12/12;
  новые route tests → unit3 PASS12/12 (последний вход).
- browser1 4/5PASS, clinic FAIL locator скрытого strong в закрытом details;
  проверяем aria-label видимого summary; browser2 точечный clinic PASS1/1.
- config1 PASS7/7: profiles, proxy, local launch/rollback commands.
- dev1 canonical JWT/auditDB поднял API+один web; Ctrl+C штатно остановлен,
  порты3000/4012 затем свободны. Legacy dev-процессов не было.
Остаток: реальный password/cookie/legacy-return через proxy, финальный build,
review/diff и актуализация статуса. Полная product/production equivalence не
объявлена. Push/CI не выполняем по прямому решению владельца.

Финальная сборка web-build3 PASS4/4, 44.863s, включает GET legacy adapters.
Dev2 session2651 запущен стандартным npm run dev:pilot; canonical API+web ready.
Новый отдельный auth-proxy сценарий (password/cookie/legacy return), попытка1:
fixture preflight FAIL до браузерного входа: require password-codec относителен
cwd apps/e2e, а scoped команда запускается из корня. Исправлен путь относительно
__dirname; следующий запуск только этого нового сценария (его попытка2).
Базовый browser routes gate завершён5/5 на попытках1/2, не повторяем.

Итог локального этапа: LOCAL_RUNTIME_VERIFIED; полная миграция по этапам5/6
остаётся IN_PROGRESS до расширенной приёмки и решения production вопросов.
Auth-proxy попытка2 PASS1/1 (11s): реальный пароль через /api, handoff в
/clinic/documents, HttpOnly-cookie restore после sessionStorage.clear(),
legacy GET→login→workspace, POST legacy405. Fixture revoke всех её сессий.
Итого проверено6 новых browser scenarios (5 routes/mobile +1 auth), без
повторения уже зелёных сценариев. Исходные blockers старых задач не изменены.

Финальные проверки: config7/7, node --check обоих scripts, git diff --check PASS;
web-build3 включает последнюю реализацию маршрутов, TS внутри сборки PASS.
Базовый typecheck13/13, unit12/12; отдельный новый auth fixture изменён после
общего typecheck и проверен выполнением Playwright, полный typecheck не повторён.
Review: scope/route imports, trusted return allowlist, fixed upstream, отсутствие
новых зависимостей, Docker legacy target не использует исключённые сборки,
сохранение ранее грязных файлов. Изменения API/payments/данных старого scope
не продолжались. DB writes только synthetic browser fixtures в audit DB.

Не проверены: production runtime CSP/ingress/container, полный operator MFA
login, multi-tab/revocation/org switching и uploads/downloads/notifications,
полный legacy rollback runtime и весь business verify:web. Release workflow
сохраняет прежнюю матрицу до согласованного production переключения; не считать
её готовой для unified release. Следующий этап: отдельная локальная расширенная
приёмка auth/оператор/файлы и rollback, затем согласованные release settings.

Owned dev2 session2651 оставлен для владельца, http://127.0.0.1:3000; process
readback: web5924, API17816; порты3001/3002/3003 не слушают. Canonical main646dab5.
Новых commit/push/CI нет: push отложен, смешанный прежний WIP не публиковали.
Практики: Agency backend/frontend (границы и reuse), Playwright (browser
verification; regression spec по обязательному AGENTS). No new agents.
