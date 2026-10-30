import type { ClientTransport } from "../transport-contract";


export function internalNotifications(transport: ClientTransport, organizationId: string, offset = 0) { return transport.get<import("@marketplace/schemas").InternalNotification[]>(`/notifications/organizations/${encodeURIComponent(organizationId)}?channel=IN_APP&limit=50&offset=${offset}`); }

export function notificationInbox(transport: ClientTransport, organizationId: string, query: import("@marketplace/schemas").NotificationInboxQuery = {}, options?: { signal?: AbortSignal }) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    return transport.get<import("@marketplace/schemas").NotificationInbox>(`/notifications/organizations/${encodeURIComponent(organizationId)}/inbox?${params}`, options);
  }

export function readNotificationInbox(transport: ClientTransport, organizationId: string, before: string) { return transport.post<{ count: number }>(`/notifications/organizations/${encodeURIComponent(organizationId)}/inbox/read`, { before }); }

export function readNotification(transport: ClientTransport, id: string) { return transport.post<import("@marketplace/schemas").InternalNotification>(`/notifications/${encodeURIComponent(id)}/read`, {}); }
