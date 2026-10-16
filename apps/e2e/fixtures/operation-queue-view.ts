import type { OperationQueueItem, OperationWorkQueue } from "@marketplace/schemas";

export function queueItem(overrides: Partial<OperationQueueItem> = {}): OperationQueueItem {
  const id = overrides.id ?? "30000000-0000-4000-8000-000000000001", queueType = overrides.queueType ?? "CATALOG_REVIEW";
  return { id, queueType, caseKey: `${queueType}:${id}`, title: "Проверка загрузки назначения",
    organizations: [{ id: "20000000-0000-4000-8000-000000000001", name: "Тестовый поставщик" }],
    openedAt: "2026-10-16T00:00:00.000Z", updatedAt: "2026-10-16T00:00:00.000Z", priority: "HIGH", dueAt: null, isOverdue: false,
    reason: "Нужно проверить карточку", href: `/admin?section=catalog&queueType=${queueType}&object=${id}`, assignment: null, ...overrides };
}
export function queuePage(items: OperationQueueItem[], overrides: Partial<OperationWorkQueue> = {}): OperationWorkQueue {
  return { generatedAt: "2026-10-16T12:00:00.000Z", operatorOrganizationId: "20000000-0000-4000-8000-000000000001", totalOpenItems: items.length, total: items.length, offset: 0, limit: 50, hasMore: false, items, ...overrides };
}
