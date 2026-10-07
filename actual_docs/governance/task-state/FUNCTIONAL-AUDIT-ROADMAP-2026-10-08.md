# Функциональный аудит и приоритетный roadmap

## Scope и владение

08.10.2026. Явный запрос владельца: сохранить подробный функциональный аудит и
roadmap как приоритет №1; исключить обязательную заявку в поддержку для ERP;
потребовать самостоятельное подключение в кабинетах клиники/поставщика и
совместную реализацию backend/UI в каждой пользовательской задаче.

Тип: docs-only. Исполнитель этой документационной задачи — PlatformaMarket UI
(`01a11795-17a2-7f52-9e7d-b3314bf87ed7`). Продуктовая задача не перехватывается.
Запись начата только после native read_thread: primary STATUS-TOASTS idle,
turn completed, публикация e68a518 подтверждена его receipt. До этого — только
чтение и подготовка текста. Постоянный primary реестра не меняется.

Canonical root: C:/Users/user/Desktop/dentmarket-kz-main, main@e68a518b6e0607abb684ef748bd51a8ab7a62c88.
Сохранены чужие dirty: .codex/project-session.json, PROJECT_HANDOFF.md,
PRIMARY-SESSION.md и generated apps/web/AGENTS.md, CLAUDE.md. Их не stage/publish.
Продуктовый код, DB, dev-процессы и реальные интеграции не меняются.

## План и риск

Сохранить приоритетную карту и критерии R0–R9; прежний roadmap остаётся единым
реестром checklist/status этих же ID. Согласовать AGENTS/Workflow/overview и
точки входа. Риски: второй backlog, противоречие источников, приравнивание
целевого self-service к готовому runtime, смешение исторического evidence/WIP.

Проверки: локальные ссылки/якоря, согласованность приоритетов/сценариев/статусов,
источники утверждений, git diff --check и review только собственных путей.
Нет оснований повторять TS/build/DB/browser suites ради Markdown. При PASS —
собственный conventional commit и обычный push по постоянному разрешению §8,
проверка remote SHA и отдельный фактический CI snapshot; без ремонта чужого CI.

## Evidence исходного аудита

Срез 1fb24ca9698769c69d2c23265f6a9a7105fecd45. 24 server test files / 163 tests
PASS: 13/79 и 11/84, первая попытка каждого. Точные команды и границы находятся
в [приоритетном документе](../../FUNCTIONAL_AUDIT_AND_ROADMAP_2026-10-08.md).
Это unit/service evidence, не новая общая PG/E2E/production приёмка.

## Результат

LOCAL_DOCS_PASS: приоритетный документ сохранён; AGENTS, Workflow, overview,
оба README, индекс, реестр R0–R9 и Matrix согласованы. R3.5–R3.6 фиксируют
самостоятельное подключение обеих ролей и совместный backend/UI результат.
Самопроверка: фактический срез/новые требования/исторический PASS разделены;
чекбоксы продуктовых результатов не закрыты, обязательные guards не ослаблены.
Node read-only проверка10 документов: 241 локальная ссылка, missing0; code fences
сбалансированы. Предварительный git diff --check PASS; staged check попытка1
выявила лишнюю пустую строку EOF нового документа, исправлена до публикации.
Повторный staged check после этого исправления (попытка2) — PASS.
Diff review собственных10 путей PASS;
прежние dirty metadata и generated web instructions не включаются.
Commit/push и CI на момент этой записи PENDING; результат публикации — receipt
в финальном ответе, commit находится по этой карточке в Git history.
Новые ERP подключения и runtime UI в этой редакции не реализованы.
