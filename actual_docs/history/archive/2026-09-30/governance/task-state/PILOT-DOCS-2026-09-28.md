# PILOT-DOCS-2026-09-28 — согласование источников правды

Тип: docs-only. Владелец: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1.
Основание: запрос владельца28.09 документировать пилот, акции, панель площадки,
актуализировать требования/техническую очередь/статусы и учесть боковой диалог.
Baseline: canonical main278be21cb36f913ef508756b4246ee28035aaf86.

## Scope и результат

- Product §23: три кабинета, полный внутренний цикл, акции со снимком текущей
  цены, модерация и отдельное размещение на главной, лимиты/подарки/истечение.
- Боковой чат «Ручное предложение поставщика» прочитан через read_thread;
  единственная карточка/много предложений, ручной и файловый способы сохранены.
  Недоступное API дополнение пользователь передал текстом: клинике только
  условия акции в заказе, поставщику история и шаблоны→новый черновик/модерация.
- Foundation §4.2: зависимая очередь без запуска реализации; старое обязательное
  operator review оплаты заменено на отложенное согласование поставщиком.
- Acceptance Matrix: актуальное evidence ORGANIZATION-READY/CORE-04 и открытый
  остаток; требования, реализация и приёмка явно разделены.
- Новые интеграции, приложение, БД, CI-конфигурация, code scopes не менялись.
  CORE-02/03 остаются отложенными до разрешённой задачи; полная приёмка требует
  выбранного порядка оплаты. Внешние СДЭК/1С/PSP не обязательны все одновременно.

## Сохранность и проверки

Прежний dirty scope исключён из staging: .codex/project-session.json,
PROJECT_HANDOFF.md, PRIMARY-SESSION.md, CORE-04-2026-09-25.md, четыре next-env.d.ts,
apps/e2e/tests/flow-a.spec.ts. Их история не переписана.
Применены Workflow/context и практика Git Workflow Master: scoped commit,
сохранение чужого WIP, conventional commit, fast-forward и exact-SHA CI;
никаких worktrees/rebase/force-push и агентов.
DoD: согласованность/ссылки, review полного собственного diff, git diff --check,
scoped commit/push, remote SHA, фактический CI. Runtime suites локально NOT_RUN:
изменение только Markdown. Лимит CI ожидания45мин, не более3 диагностических
попыток на один блокер; новое source evidence не создаётся документацией.

UI standard ссылается на Product §23 без дублирования бизнес-контракта.
Review собственного diff, согласованность и локальные file links PASS;
git diff --check PASS. Runtime tests локально NOT_RUN (docs-only).
gh CLI отсутствует; для CI используется существующий read-only GitHub API reader
с отдельным outputs/pilot-docs-20260928 receipt, старое evidence не перезаписывается.
Статус публикации: main7f494027b0318705f2e84b5d6d65d61db6e6535d отправлен
обычным push; remote SHA совпал. Только5 Markdown paths, прежний WIP исключён.
Статус: CLOSED. Security36345764684 и CI36345764593 SUCCESS на точном7f49402;
verify35 successful steps и PostgreSQL12 successful steps, browser PASS.
Повторных запусков нет, attempt1. Receipt: outputs/pilot-docs-20260928/ci-readback.json.
Новые якоря канонических ссылок PASS4/4; старое evidence CORE-04 сохранено.
Этот post-push operational receipt локальный, не дополнительное изменение требований.
Следующий шаг: сообщить ссылки на источники правды; ожидать выбора code scope.
После доставки остановиться; следующий code scope выбрать с владельцем.
