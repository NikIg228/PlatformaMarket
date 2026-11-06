# Support: исправления оставшихся находок audit-005

Владелец 06.11.2026 явно разрешил исправить все оставшиеся пункты отчёта и
проверить desktop/mobile, включая KK. Scope: пункты 2–5
[audit-005](../../../anti-slop/audit-005-2026-11-06.md). Канонический checkout
`main@5161af7f`; прежние WIP и 18 staged paths сохранены.

## Получившееся поведение

| Пункт | Изменение | Доказательство |
| --- | --- | --- |
| 2: ошибка узкого списка | Текст ErrorState получает доступную ширину, recovery DmButton находится следующей строкой в feature-композиции. Общие параметры feedback/controls не переопределены. Колонка может прокручиваться целиком при недостаточной высоте; error/recovery не сжимаются в непригодную полоску. | 8 browser cases: RU/KK × supplier/clinic ×1440/390; ширина текста >150px, recovery доступна и работает. [Desktop](../../../output/support-remaining-fixes-20261106/list-error-desktop.png) |
| 3: повреждённое изображение | Внутри dialog используется постоянный inline ErrorState вместо исчезающего ActionFeedback toast. Escape закрывает окно и возвращает focus к preview. | Alert внутри dialog остаётся после 5.5s; RU/KK и оба viewport. [KK mobile](../../../output/support-remaining-fixes-20261106/broken-preview-kk-mobile.png) |
| 4: KK | Workspace передаёт locale в BuyerContextBar; переведены label/описание/личный режим/действия/loading/recovery. SupportFilePicker, attachment errors и действия поддержки задают локализованный toast title; глобальная политика toast не меняется. Переход к форме первого обращения сохраняет lang=kk. | [Панель клиники](../../../output/support-remaining-fixes-20261106/clinic-kk-mobile.png), [заголовок ошибки файла](../../../output/support-remaining-fixes-20261106/file-error-kk-mobile.png), 2 first-request-locale cases |
| 5: история | Намерение прокрутки применяется в useLayoutEffect после commit списка messages. Первоначальная загрузка/ответ ведут вниз; приход новых сообщений при чтении сверху сохраняет позицию; ранняя история сохраняет якорь относительно списка. | Ранее падавший poll/jump case PASS; 2 prepend cases; начальная позиция проверена в 8 profile cases. [Desktop](../../../output/support-remaining-fixes-20261106/history-bottom-desktop.png) |

Новые параметры общих controls, API, backend, схемы/миграции, dependencies,
рабочие данные и общий редизайн не входят в изменение. Shared SupportAttachmentList
сохраняет default RU для legacy/operator consumers; штатные operator attachment
и toast сценарии также проверены.

## Проверки на текущем изменении

Всего **39 уникальных постоянных Support browser cases имеют PASS** на релевантных
финальных inputs. Их выполняли адресно, без повторения уже зелёных неизменённых
сценариев:

- `npm exec -- playwright test --config=apps/e2e/playwright.support.config.ts --grep 'background refresh preserves scroll'`: 1 PASS, первая попытка после исправления DOM commit/scroll.
- Тот же config, `--grep 'remaining findings'`: 8 PASS, первая попытка; 32 screenshots.
- Тот же config, `--grep-invert 'remaining findings|background refresh preserves scroll'`: 26 PASS / 2 FAIL из 28. Первый failed — сохранение формы первого обращения после ошибочного ответа; второй — 0.5px разницы в новом prepend assertion с допуском <0.5px.
- После сохранения query locale: `--grep 'first request|fills available width'`: 7 PASS. Сюда вошли оба first-create/retry, три width states и два новых first-request-KK cases. Первоначальный сбой формы сохраняется в журнале; его причина не объявляется доказанным эффектом нагрузки или исправленным багом из-за одной зелёной повторной проверки.
- `--grep 'prepended history.*1440'`: PASS. Assertion допускает <=1px, потому что scrollHeight округлён, а line boxes дробные; прежняя мобильная проверка прошла с более строгим допуском. Большой скачок позиции по-прежнему вызывает FAIL.
- `npm exec -- playwright test --config=.tmp/support-layout-audit-20261106/transient.config.ts --grep '390'`: ещё **2 PASS** в Chromium isMobile/hasTouch RU/KK. Проверены invalid/upload pending/upload failure/retry, reply pending/error/retry/success, preview и повреждённое изображение. Предыдущий audit gate с 3 FAIL не переписан; это новая проверка после явно разрешённого исправления изменённых inputs.

Финальные typecheck UI/web/buyer-web/E2E и scoped ESLint — exit0, точные результаты
в `.tmp/support-remaining-fixes-20261106/final-checks.json`. В первом E2E typecheck
найден TS2488 у старого browser regression (HTMLCollection не iterable в E2E
tsconfig); применён Array.from без изменения assertions, финальная проверка PASS.
UI contract PASS: 473 CSS/TSX files; общие design tokens не менялись.

Финальные unified web и buyer-web go_live builds — **PASS, exit0 обе команды**,
включая встроенную TypeScript-проверку и buyer bundle budget. Команды:
`npm exec -- node .tmp/support-fixes-20261106/width-build.mjs` и
`npm exec -- node .tmp/support-remaining-fixes-20261106/buyer-build.mjs`.
Web использовал отдельный distDir/tsconfig; обе generated next-env declarations
восстановлены и имеют clean diff относительно HEAD.

Дополнительная проверка error recovery через `geometry.config.ts`:
**3 PASS** (clinic KK, 320×568/761×800/1440×360), включая реальный click retry,
scroll/actionability и сохранённые computed styles. Нет нового global overflow.
При визуальном просмотре geometry1 обнаружено, что на высоте360 обычный
toBeInViewport/actionability пропускал частично видимую кнопку. После настройки
прокрутки всей колонки geometry2 проверяет `ratio:1`: PASS3 с полностью видимой
кнопкой. Финальный screenshot показывает читаемую ошибку и всю recovery-кнопку.
После этой CSS-правки повторены только 8 profile cases +2 dense-list consumers,
UI contract и unified web build; buyer build и функциональные проверки прокрутки
переиспользуются для неизменённых соответствующих inputs.
Фактический итог этого повторения: **10 browser PASS**, **UI contract PASS**,
**final web build exit0**. Final source hashes обновлены после CSS-правки;
generated next-env сохранены без diff. Ссылки отчётов и `git diff --check` PASS.
Эти 3 случая и 2 touch cases дополняют 39 постоянных сценариев — **44 PASS**
в выбранных группах; прежние failed attempts сохранены выше и в логах.

Полные logs,
screenshots и source hashes сохраняются в `output/support-remaining-fixes-20261106/`;
plan, before snapshots и runners — в `.tmp/support-remaining-fixes-20261106/`.

## Границы результата

Browser requests перехвачены существующим fixture API; реальные обращения,
сообщения и файлы не отправлялись. Физические Android/iPhone, OS keyboard,
Safari/WebKit, реальный screen reader и работа реального scanner/storage не
сертифицированы. UI tests не являются новой backend/DB/security приёмкой.

Live dev API4012/web3000 остаётся включённым. Никакие чужие процессы не остановлены.
Commit/push/deploy отсутствуют: сохраняется ранее доказанная зависимость support
patch от незакоммиченного loading-state change set и неподтверждённого общего
диапазона семи исходящих commits. Чужой index не используется для публикации.
Это локальная проверка выбранных исправлений, не release certification проекта.
