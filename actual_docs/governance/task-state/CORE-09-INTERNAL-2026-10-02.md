# CORE-09 — итоговая приёмка внутреннего ядра

Статус LOCAL_CORE_PASS02.10.2026,15:57+05; docs publication впереди. Один primary writer:
01a0f302-2d38-75d1-b79c-141e7428b533. Продолжение явного поручения владельца
завершить CORE05–09 с backend/frontend, устранением блокеров и итоговым аудитом.
Canonical root C:/Users/user/Desktop/dentmarket-kz-main, main,
кодовая ревизия64591bcebb765378b7383df6243571925bb22498 = origin/main.
Семь прежних WIP отдельно: registry, AGENTS/Workflow,4 legacy next-env.

## Граница и критерий завершения

Принять уже реализованные CORE01–08 outcomes на одной ревизии, связать
backend/API/browser evidence, проверить отсутствие известного критического
риска в этом scope и актуализировать Foundation/Matrix. Итог — LOCAL_CORE,
не POST-BE/POST-FULL, production или реальный пилот. Новых функций не требуется,
если проверки не выявят конкретного дефекта. Внешние сервисы, реальные данные,
working migration150000, рабочий dev и новые агенты/worktrees вне scope.

## План проверки / reuse

CI36996467232 и Security36996467259 completed SUCCESS на64591bc: оба контейнера,
чистый npm ci, Prisma, root types/lint/unit/build, PG lifecycle/upgrade/races,
authority/backup-restore, runtime/config/contracts, extended API, FlowB3 и
canonical browser. Это текущая ревизия, не исторические отдельные PASS01–07.
Не повторять те же gates локально без изменённых входов.

Локальный frontend artifact сейчас pilot; акции требуют go_live. Единственный
дополнительный запуск: build apps/web с явным DEPLOYMENT_PROFILE=go_live,
затем существующий playwright.promotions.config.ts (desktop/mobile) через
db:test/run-canonical-browser. Использовать dentmarket_audit_20260914/public,
synthetic fixture offerPromotionFixture с cleanup. API artifact08 переиспользуется.
Порты3000/4012 свободны, owned test processes только на время проверки.
Попытки build/browser09:0, прежние08 попытки не сбрасываются. Command20m,
browser suite45m, максимум3 на новый gate; одинаковую ошибку без гипотезы не повторять.

После PASS — self-review evidence/документов/границ, diff/link checks,
docs-only commit/push main и actual CI; runtime checks reuse для тех же входов.
До фактической публикации и CI не объявлять всю последовательность закрытой.

## Карта доказательств одной ревизии

| Outcome | Код проверки / среда |
| --- | --- |
| CORE01 договоры, допуск, expiry/reacceptance, tenant | verify-postgres-integration → verify-contract-lifecycle; extended onboarding-agreement |
| CORE02 подтверждение, точная ручная оплата, dispute/CAS/replay | verify-manual-payments; workspace-rebuild browser; деньги synthetic |
| CORE03 split receipt/closure, refund authority/rollback, reorder | verify-order-returns; те же реальные PostgreSQL workflow transactions; browser retry/consent |
| CORE04 import/moderation/publication/rollback, N+M | FlowB3 canonical browser; verify-offer-promotions PG; отдельный go_live browser ниже |
| CORE05 email/reset/invites/roles/revoke/MFA | identity unit regressions; platform-authority; identity-management browser3 roles; local mail |
| CORE06 queue/support/conversations | verify-conversations PG; conversations browser трёх ролей; CAS/idempotency unit |
| CORE07 exact commission/returns/dataset/repeat/timezone | verify-commerce-analytics в PG receipt chain; commerce-analytics browser |
| CORE08 contracts/limits/lint/profile/Swagger | core-contract59 assertions, HTTP/allocation tests, maximum10MB real upload+413 browser, lint-policy/config |
| Multi-supplier checkout / documents | extended search-commerce:4 distinct supplier orders; document-compliance + canonical document upload/download |

Это составная приёмка согласованного внутреннего цикла. Unit/mock UI cases
не выдаются за реальные внешние операции; PostgreSQL/API и реальные browser
fixtures указаны отдельно. Нового единого live заказа не создаётся.

## Остаток / вопросы

Q01 production policy уже решена владельцем: сохранять строгие требования,
внешние сервисы/production запуск отдельно. Новых продуктовых решений не требуется.
Известны5 dev-only dependency advisories из CORE08; runtime audit0 и Security PASS.
Legacy buyer bundle budget остаётся отдельным историческим остатком, основной
runtime apps/web проходит. Working migration150000 не применена, dev остановлен.
Юридические тексты, реальные провайдеры/доставка и учёт полученной комиссии
не становятся принятыми благодаря synthetic evidence.

## Итоговый аудит и evidence

Дополнительные gates09 PASS1: `$env:DEPLOYMENT_PROFILE='go_live'; npm run build
--workspace=@marketplace/web`; `npm run verify:web-bundle` (24chunks,
358803gzip bytes); `npm run db:test -- exec -- node scripts/run-canonical-browser.mjs
--config playwright.promotions.config.ts` —2/2,21.9s,1366/390px. Реальные API/DB,
модерация/отказ self-approval/витрина/фильтры/checkout/gift snapshot/overflow.
Fixture cleanup выполнен, серверы завершены. Generated next-env возвращается к HEAD.

Логи CI job110804220758 подтверждают canonical57/57, FlowB3 7/7 и checkout4
distinct suppliers. PG job110804221048 подтверждает contracts/payment/returns/
promotion/conversations/analytics invariants, race/rollback и cleanup; authority
и restore PASS. Runs: https://github.com/NikIg228/PlatformaMarket/actions/runs/36996467232
и https://github.com/NikIg228/PlatformaMarket/actions/runs/36996467259.

Self-review проверил coverage→outcome, synthetic/live границы, schema/client/OpenAPI,
права до доступа к данным, exact money/transaction/replay, UI feedback и профиль
сборки. Новых критических дефектов в этом scope не выявлено; это не независимый
security audit. Применены development-toolkit verification/review и ранее прочитанные
Agency Code Reviewer/Git Workflow Master; отдельные агенты не запускались.
Foundation/Matrix исправлены: завершённые05/08/09 не числятся будущей реализацией.

Не запускались working migration, dev, внешние providers, production rollout,
новая общая POST-FULL или POST-BE приёмка — они вне поручения. Повторные локальные
root unit/PG/runtime/core suites не нужны: полный CI на той же64591bc уже PASS.
После review/diff/link checks — итоговый docs commit/push; его фактический CI
проверяется отдельно, без повторной реализации и без нового backlog.
