# PUBLISH-WIP — публикация накопленных изменений

Основание: владелец 06.10.2026 явно поручил commit/push всех незакоммиченных
изменений. Это разрешение включает ранее разделённые UI, Orders/Notifications,
Support и governance slices; прежняя невозможность публиковать чужую зависимость
больше не блокирует их совместную публикацию. Требования проверок сохраняются.
Исполнитель: текущая боковая беседа; product primary не переназначается.
Canonical root C:/Users/user/Desktop/dentmarket-kz-main, main@a8f6ec0.
Primary и Market UI idle по native listing. Новых агентов/worktrees нет.

План: проверить полный diff и untracked inventory, приватные данные и случайные
generated artifacts; сопоставить существующие PASS с текущими входами; закрыть
остающуюся проверку document deep-link после исправления фокуса. Затем явный
staging проверенного набора, commit, fast-forward push, remote SHA и CI snapshot.
Риски: неполная зависимая публикация, потеря staged scope, неподтверждённый PASS,
случайные секреты/данные в артефактах. Product feature scope не расширяется.

Проверки: diff hygiene, source hash/evidence review, применимые focused checks;
полный release/E2E не запускается только ради push. Каждый gate максимум3 попытки,
20 минут на check и15 на диагностику. Document deep-link уже имел FAIL1 до
исправления; здесь попытка2, прежний счётчик сохраняется. Рабочая БД не изменяется.
Локальный manifest: .tmp/publish-wip-manifest.json. Состояние: LOCAL_PASS.

## Проверенный состав и результаты

237 путей с этой карточкой: приложения/пакеты, tests и UI guard, согласованные
документы/governance и19 сохранённых файлов дизайн-референсов в output.
Игнорируемые .env, runtime storage, test reports, .tmp и build outputs не входят.
Tracked next-env изменения проверены: только generated type imports, без данных.
Дизайн-референсы содержат демонстрационные данные; текущие снимки инспектора
просмотрены. Проверки ключей, приватных key-файлов, credential URLs/JWT и файлов
больше50MB не выявили кандидатов; это не полная security-сертификация.

Snapshot:131 изменённый tracked UI source совпадает с финальным UI patch.
25 backend/schema/client files совпадают с сохранённым pre-UI baseline tree;
7 новых файлов Orders/Inbox не были в этом tree, поэтому их gates проверены заново.
Lockfile неизменён, новые dependencies не вводятся. UI shared consumer/build/types
evidence из UI-CONTRACT остаётся применимым; support backend/PG/runtime из
SUPPORT-UX и .tmp/support-files-* переиспользуются на неизменённых входах.

Новые проверки:
- `npx --no-install playwright test --config apps/e2e/playwright.workspaces.config.ts
  --grep 'orders-ux document deep link'`: PASS1 case, историческая попытка2 после
  исправления фокуса. Log .tmp/publish-document-deeplink2.log.
- `npm run db:test -- exec --workspace @marketplace/api -- vitest run
  src/modules/notifications/notification-inbox.postgres.spec.ts
  src/modules/notifications/notification-inbox.spec.ts
  src/modules/notifications/notifications.service.spec.ts
  src/modules/commerce/workspace-orders.spec.ts`: PASS21, изолированная БД.
- `npm run typecheck --workspace @marketplace/api`: PASS.
- `npm run test --workspace @marketplace/ui`: PASS76/14 suites.
- `npm exec --workspace @marketplace/api-client -- vitest run
  src/notification-inbox.test.ts src/support-workflow.test.ts`: PASS3.
- `git diff HEAD --check`: PASS. Final staged review остаётся перед commit.

Development Toolkit verification и Agency Git Workflow Master применены:
сопоставление evidence, явный path list, полный outgoing range, обычный fast-forward.
Новых реализаций, миграций и рестарта dev нет. Full release/E2E не запускались:
публикация накопленных принятых slices не является production certification.
Следующий шаг: commit/push согласованного полного набора и remote/CI snapshot.
