> ARCHIVE · снимок до пересборки06.10.2026. Старые статусы, команды и следующие шаги не являются текущим поручением. Требования: [описание проекта](../../../../../PROJECT_OVERVIEW.md); остаток: [roadmap](../../../../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md). Приёмка ограничена указанными в исходном тексте версиями.

# DOCS-ARCHITECTURE-AUDIT — результат и checkpoint

Дополнение01.10: публикация объединена с отдельно разрешённым
[PERFORMANCE-CI-DELIVERY](PERFORMANCE-CI-DELIVERY-2026-09-30.md). Docs/архив
перепроверены после реализации, опубликованы в8045225. CI/Security75e0e21 PASS;
итог DOCS-ARCHITECTURE-AUDIT: CLOSED / PUBLISHED. Доказательства — в той карточке.
Ниже сохранён исходный docs-only scope и его историческое ограничение.

Обновлено30.09.2026. Состояние: DOCS_LOCAL_PASS;
публикация BLOCKED существующим CI FAIL, не полное завершение доставки.
Владелец/единственный writer:01a0f302-2d38-75d1-b79c-141e7428b533, generation4/idle.
UI-задача приостановлена владельцем, idle подтверждён; новых агентов не создано.

## Разрешённый результат

Проверить всю техдокументацию по коду, архивировать устаревшие/выполненные
карточки без возобновления их задач, затем подготовить архитектурные/frontend
предложения. Изменения продукта, БД, dependencies/CI и dev не входят.

## Входы и итог

Canonical root: C:\Users\user\Desktop\dentmarket-kz-main.
main/HEAD/origin main:2a816c337bae15f6684318cf26d21bf6f71cb3c5;
финальные rev-parse и ls-remote подтвердили точное совпадение.
Исходные protected dirty: .codex/project-session.json и четыре legacy
next-env.d.ts сохранены byte-for-byte; прежние незакоммиченные handoff/primary/
workspace-audit receipts сохранены в полных предыдущих версиях архива.

-115 исходных tracked textdocs рассмотрены/классифицированы (110md/mmd+5txt).
-29 старых task/audit/plan документов и240 связанных reference assets
 перемещены в archive30.09.36 полных предыдущих версий активных docs сохранены.
 В Markdown архива изменены только destinations ссылок, история/попытки сохранены.
-README/Handoff/Primary/architecture/applications/Foundation/Matrix обновлены.
 Product/ADR/UI/runbooks уточнены по последним решениям и коду; новые правила
 не изобретены. Открытые CORE/AUD/B5/POST/EXT и незакрытый browser остаток сохранены.
-DOCUMENTATION_INDEX — полный реестр; CODEBASE-AUDIT — code-backed предложения
 по public catalog, supplier reads, admin, request/cache boundaries и services.
-AGENTS/Workflow исключают архив из обычной реализации. Код не менялся.

## Проверки и попытки

node outputs/docs-architecture-audit-20260930/verify-docs.cjs — PASS, попытка2/3:
59 действующих Markdown документов,397 действующих и481 архивная ссылка,
96 npm command mentions,115 исходных документов,305 archive entries;
1508 protected hashes совпали, исходная история сохранена, missing0.
Попытка1 обнаружила одну старую ссылку Product на архив14.09 в рабочем маршруте;
она заменена ссылкой на индекс. Не было runtime failure/rerun.

node outputs/docs-architecture-audit-20260930/anchors-and-scope.cjs — PASS:
8 локальных section anchors, ошибок0; code/config diff только исходные5 dirty.
git diff --check — PASS. Self-review: scope, решения/статусы, перенос остатка,
ссылки/команды, лицензия/fonts, отсутствие новой runtime/production сертификации.

Reference move: первая попытка остановилась до записи из-за Git quoted
Cyrillic paths, вторая с ls-files -z PASS/240 hashes; лимит не обнулялся.
TS/unit/build/DB/browser/security suites NOT_RUN: docs-only, продукт неизменён.
Собственных фоновых процессов, сервисов и внешних операций в полёте нет.

Локальные evidence: outputs/docs-architecture-audit-20260930/baseline.json,
source-metrics.json, reference-archive-hashes.json, docs-verification-attempt1.json,
docs-verification.json и reconciliation scripts. Архивный manifest tracked;
полные runtime logs остались ignored и не публиковались.

## Публикация и следующий шаг

Commit/push NOT_RUN: AGENTS §8 блокирует публикацию при failed gate;
CI36737223743 FAIL и Security36737223539 dependencies FAIL известны на текущем
SHA. CodeQL PASS, A01–A18 LOCAL_PASS, legacy buyer budget FAIL сохранены.
Документационные проверки не исправляют эти gates. Реальный index пуст.
Полнота доставки не объявлена завершённой; auto-handoff/архивация задачи не начаты.

Один следующий шаг при отдельном разрешённом scope: согласовать test DB selection
wrapper с CI fixture guard без ослабления изоляции, затем фактический gate/CI.
Не возобновлять весь backlog и не выполнять оптимизации из отчёта автоматически.

Применены прочитанные development-toolkit review/performance/verification,
Agency Backend Architect/Frontend Developer/Code Reviewer/Git Workflow Master:
code routes, измеряемые гипотезы, scope и история. Делегирования нет.
