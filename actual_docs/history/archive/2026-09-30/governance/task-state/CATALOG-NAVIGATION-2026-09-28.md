# Компоновка каталога и input modality — 28.09.2026

Владелец: primary01a0c957-1f23-7b70-9dc9-226afbb5c0b1, canonical main@da416ac.
Статус: реализовано локально; публикация blocked зависимым прежним WIP. Существующий WIP сохранён; миграция единого приложения отложена.
Scope: общая pointer/keyboard подсветка, компактный sticky header, поиск внутри
каталога, крупные категории из API, sticky sidebar, мобильные фильтры.
Данные/API/оплаты не изменяются. Предложенная высота шапки64px, светлый почти
непрозрачный фон с границей. Категории и поиск не sticky.
Практики: Agency Frontend Developer — компоненты, доступность, адаптивность;
прочитаны Workflow и релевантный UI standard. Один writer, без агентов.
Gates: root typecheck/unit, scoped browser live API1280/390 и общие controls
четырёх приложений; затронутые frontend production builds, diff check.
Новые inputs и UI scope; старый catalogue5/7 и payment blocker не объявляются
PASS и их счётчики не сбрасываются. Для новых gates max3, команды20мин,
browser45мин, server5мин. Не запускать build одновременно с dev.
DoD: отсутствие pointer ring, видимый keyboard focus, URL/search/categories/
return,4desktop columns, sticky/filter overflow/layering и mobile.

Checkpoint: отдельный согласованный writer завершил cosmetics auth commits
7226f7a/2108028/646dab5; их файлы сохранены, запись согласованно сериализована.
Types1 PASS12/12. Unit1 CLI FAIL duplicate concurrency; unit2 FAIL Node EventTarget
boolean capture cleanup; одинаковый options object устранил расхождение; unit3
PASS11/11. Browser1 CLI FAIL npm forwarding; underlying verify:web alias прочитан,
без prerequisites; browser2 PASS desktop/clinic/landing, FAIL mobile horizontal
min-content sizing и operator fixture (форма выключена реальным capability).
Исправлены width/min-width каталога и isolated response fixture только для
render operator controls, без login/write. Browser3 только failed cases; supplier
отдельно не проверяется; прежние PASS не повторять без изменения входов. Лимиты сохранены.
Browser3 PASS2/2 после width/min-width и explicit operator UI fixture.
Итого new scope browser5/5; старые кейсы не выдаются за повторно принятые.
Операторская проверка — только форма/фокус, не реальный login. Supplier не покрыт
отдельным browser case; использует общий MarketplaceProvider. Unit3 PASS11/11.
Адаптированы прежние search locators к переносу из header в catalog search.
Следующий gate: final types + production builds4apps; dev82593 остановить
штатно, после сборки вернуть. Счётчики browser3/unit3, больше повторов нет.

Build1 PASS8/8: четыре frontend + dependencies, buyer/supplier bundle budgets.
Dev82593 штатно остановлен; final types затем восстановление dev. Последний HEAD
646dab5 включает три явных scoped косметических commit бокового writer;
после освобождения writer изменения основной задачи продолжены. Полный web suite
NOT_RUN: прежний deferred payment blocker не возобновлялся. Current browser
operator form использует mock client-options без изменения API/авторизации.
Unit inputs собственной логики покрыты PASS; последующие cosmetics другого
scope не объявляются принятыми этим unit pass, их автор явно не запускал тесты.
Публикация этой связанной компоновки блокируется зависимостью от предыдущего
неопубликованного CATALOG-LAYOUT/API/HEADER WIP: отдельно новые компоненты не
соберутся на origin/main. Не включать весь непроверенный WIP в commit молча.

Финал: final typecheck PASS12/12 после всех текущих исходников и e2e locator
изменений. diff check PASS. Новые runtime/API/DB/security gates NOT_RUN:
контракты, данные и доменные правила этого scope не менялись. Dev restart
session32972, canonical npm run dev:pilot, JWT/disposable audit DB; readiness ниже.
Практики Playwright screenshots/trace использованы для диагностики mobile
overflow; проверка через существующий @playwright/test по project AGENTS,
без установки CLI/библиотек. Browser5/5 по run2+run3, supplier UI не отдельный
browser PASS; общий provider и supplier build проверены. Нет нового commit/push.
Следующий точный шаг публикации: принять зависимый предыдущий CATALOG-LAYOUT/
HEADER scope и отделить его от order/payment WIP, затем review/staging.
Dev32972 восстановлен: admin3000/buyer3001/supplier3002/landing3003 HTTP200, API readiness PASS. Source hashes и mobile screenshot сохранены в outputs/internal-pilot-20260928/catalog-navigation-*. Последний diff check PASS.
