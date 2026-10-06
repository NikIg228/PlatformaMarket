> ARCHIVE · снимок до пересборки06.10.2026. Старые статусы, команды и следующие шаги не являются текущим поручением. Требования: [описание проекта](../../../../PROJECT_OVERVIEW.md); остаток: [roadmap](../../../../MAIN_ROADMAP_TO_PRODUCTION_2026-10-06.md). Приёмка ограничена указанными в исходном тексте версиями.

# Media pipeline: текущие границы и отложенные предложения

Сверка30.09.2026 статическая. Старый снимок18.08 с числами DB/media сохранён
в архиве; его500 PENDING не утверждение о текущей рабочей базе. БД не читалась.
Это reference proposal, не активная implementation task.

## Что существует

[CatalogMediaController](../../../../../apps/api/src/modules/catalog/catalog-media.controller.ts)
проверяет ticket и читает только READY с normalizedStorageKey; storage возвращает
signed URL или stream, checksum используется для ETag. Buyer public media
manifest — отдельный источник локальных assets. [Fallback resolver](../../../../../apps/buyer-web/app/catalog-fallback.server.ts)
сопоставляет live identity и точные media; наличие фотографии на странице не
доказывает READY/storage convergence. Unified web подготавливает assets из
исходных public directories, не требует их ручного дублирования.

Скрипты normalize-catalog-images/build-public-media-manifest сохраняют внешний
Supabase путь; publish-manufacturer-model-media содержит platform-specific
обработку. Их нельзя выдавать за воспроизводимую local PostgreSQL процедуру.
Обычного root catalog:normalize-media или verify:catalog-media пока нет.

## Перенесённые открытые вопросы M01–M08

| ID | Остаток, не разрешение реализации |
| --- | --- |
| M01/M06 | Определить authoritative DB/ObjectStorage и согласовать JSON fallback; сверить реальные bytes/READY/provenance только в разрешённой среде |
| M02 | Отдельно проверить eligibility PENDING при exactProductPhoto; technical readiness не равна metadata точности |
| M03/M04 | Content QA/source selection: resolution, blur, whitespace/occupancy, logo/watermark, соответствие варианту и duplicate detection |
| M05 | Производные320/640/1200 и безопасный thumbnail для длинных предметов; contain без обрезки товара |
| M07 | Подтверждённые права использования; READY не является legal approval |
| M08 | Воспроизводимый quality report/gate с checksum/MIME/dimensions/storage existence и browser smoke |

Потенциальные этапы: единый adapter/pipeline и idempotency → нормализация/QA →
согласование существующих данных → operator review/placeholder → проверки.
Не добавлять dependency/новые статусы или запускать массовый импорт по этому
предложению. Сначала отдельная task/ADR при изменении owner/storage semantics.
DoD будущей работы: оригинал/checksum/provenance сохранены, no silent crop,
READY соответствует существующему объекту, сомнительные фото отделены от
готовых, demo/права не подменены UI. Численные thresholds требуют согласования.
