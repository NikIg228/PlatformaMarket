"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CreateInvitationInput, IdentityMember, IdentityRole, InvitationCreated, InvitationDelivered, InvitationSummary, UpdateMembershipInput } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, DmFeedback, LoadingState, errorMessage } from "./index";

type MemberApi = {
  listMembers(id: string): Promise<IdentityMember[]>;
  listRoles(id: string): Promise<IdentityRole[]>;
  listInvitations(id: string): Promise<InvitationSummary[]>;
  createInvitation(id: string, input: CreateInvitationInput): Promise<InvitationCreated>;
  deliverInvitation(id: string, invitationId: string): Promise<InvitationDelivered>;
  revokeInvitation(id: string, invitationId: string): Promise<unknown>;
  updateMember(id: string, memberId: string, input: UpdateMembershipInput): Promise<IdentityMember>;
  assignMemberRole(id: string, memberId: string, roleId: string): Promise<unknown>;
  removeMemberRole(id: string, memberId: string, roleId: string): Promise<unknown>;
};
const statusText: Record<string, string> = { ACTIVE: "Доступ открыт", BLOCKED: "Доступ отключён", REVOKED: "Доступ отозван", INVITED: "Приглашён", PENDING: "Ожидает принятия", ACCEPTED: "Принято", EXPIRED: "Срок истёк" };
type Confirmation = { description: string; run: () => Promise<unknown> };

export function MemberManagement({ api, organizationId, actorId, permissions }: {
  api: MemberApi; organizationId: string; actorId?: string; permissions: readonly string[];
}) {
  const allowed = permissions.includes("organization.members.manage");
  const manageRoles = permissions.includes("organization.roles.manage");
  const [data, setData] = useState<{ members: IdentityMember[]; roles: IdentityRole[]; invitations: InvitationSummary[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const flight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!allowed) return;
    const request = ++generation.current;
    setLoading(true);
    try {
      const [members, roles, invitations] = await Promise.all([api.listMembers(organizationId), api.listRoles(organizationId), api.listInvitations(organizationId)]);
      if (request === generation.current) setData({ members, roles, invitations });
    } catch (cause) { if (request === generation.current) setError(errorMessage(cause)); }
    finally { if (request === generation.current) setLoading(false); }
  }, [allowed, api, organizationId]);
  useEffect(() => { setData(null); void refresh(); return () => { generation.current++; }; }, [refresh]);
  async function action(run: () => Promise<unknown>, message: string) {
    if (flight.current) return;
    flight.current = true; setBusy(true); setError(null); setNotice(null);
    try { const result = await run(); setNotice(typeof result === "string" ? result : message); setConfirmation(null); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { await refresh(); setBusy(false); flight.current = false; }
  }
  async function invite(event: FormEvent) {
    event.preventDefault();
    await action(async () => {
      const invitation = await api.createInvitation(organizationId, { email, roleIds: [roleId], expiresInHours: 72 });
      // The API's one-time token is deliberately not rendered or stored by this UI.
      // A failed delivery remains in the list and can be retried without creating a second invitation.
      setEmail(""); setRoleId("");
      const delivered = await api.deliverInvitation(organizationId, invitation.invitationId);
      return delivered.delivery === "LOCAL_FILE" ? "Приглашение сохранено в локальной тестовой почте. Внешнее письмо не отправлялось." : "Приглашение передано почтовому сервису.";
    }, "Приглашение создано. Результат доставки доступен после отправки.");
  }
  if (!allowed) return <section className="mp-member-management"><h2>Сотрудники и доступ</h2><p>Управление сотрудниками доступно администратору организации.</p></section>;
  const assignable = data?.roles.filter(role => role.permissions.every(({ permission }) => permissions.includes(permission.code))) ?? [];
  return <section className="mp-member-management mp-stack" aria-label="Сотрудники и доступ">
    <div className="mp-member-actions"><h2>Сотрудники и доступ</h2><DmButton disabled={busy || loading} onClick={() => { setError(null); void refresh(); }}>Обновить сотрудников</DmButton></div>
    {error ? <DmFeedback tone="danger" title="Действие не выполнено" description={error} alert /> : null}
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
    {!data ? loading ? <LoadingState label="Загружаем сотрудников" /> : <DmButton onClick={() => void refresh()}>Повторить загрузку</DmButton> : <>
      <form className="mp-member-invite" onSubmit={invite}>
        <DmField label="Email сотрудника" required><DmInput type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={(_, value) => setEmail(value.value)} /></DmField>
        <DmField label="Роль приглашённого" required><DmSelect value={roleId} disabled={busy} required onChange={event => setRoleId(event.target.value)}><option value="">Выберите роль</option>{assignable.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</DmSelect></DmField>
        <DmButton type="submit" appearance="primary" disabled={busy || !roleId || !email.trim()}>Пригласить сотрудника</DmButton>
      </form>
      {!assignable.length ? <p>Нет ролей, которые вы можете назначить. Обратитесь к администратору организации.</p> : null}
      {confirmation ? <div className="mp-member-confirm" role="region" aria-label="Подтверждение изменения доступа"><p>{confirmation.description}</p><div className="mp-member-actions"><DmButton disabled={busy} onClick={() => void action(confirmation.run, "Доступ обновлён.")}>Подтвердить изменение</DmButton><DmButton disabled={busy} onClick={() => setConfirmation(null)}>Отмена</DmButton></div></div> : null}
      <h3>Сотрудники</h3>
      {!data.members.length ? <p>Сотрудников пока нет.</p> : data.members.map(member => <article className="mp-member-card" key={member.id} aria-label={member.user.email}>
        <div><strong>{member.user.displayName}</strong><p>{member.user.email}</p><p>{statusText[member.status] ?? member.status}{member.userId === actorId ? " · Вы" : ""}</p></div>
        <div className="mp-stack">{member.roles.map(({ role }) => <div className="mp-member-actions" key={role.id}><span>{role.name}</span>{manageRoles ? <DmButton disabled={busy || member.userId === actorId} onClick={() => setConfirmation({ description: `Снять роль «${role.name}» у ${member.user.displayName}? Активные сессии сотрудника будут завершены.`, run: () => api.removeMemberRole(organizationId, member.id, role.id) })}>Снять роль {role.name}</DmButton> : null}</div>)}
          {manageRoles ? <AssignRole roles={assignable.filter(role => !member.roles.some(item => item.roleId === role.id))} disabled={busy} onAssign={id => action(() => api.assignMemberRole(organizationId, member.id, id), "Роль назначена.")} /> : null}
          <DmButton disabled={busy || member.userId === actorId} onClick={() => setConfirmation({ description: member.status === "ACTIVE" ? `Отключить доступ ${member.user.displayName}? Его сессии и незавершённые приглашения будут отозваны.` : `Восстановить доступ ${member.user.displayName} с указанными ролями?`, run: () => api.updateMember(organizationId, member.id, { status: member.status === "ACTIVE" ? "BLOCKED" : "ACTIVE" }) })}>{member.status === "ACTIVE" ? "Отключить доступ" : "Восстановить доступ"}</DmButton>
        </div>
      </article>)}
      <h3>Приглашения</h3>
      {!data.invitations.length ? <p>Приглашений пока нет.</p> : data.invitations.map(invitation => <article className="mp-member-card" key={invitation.id} aria-label={`Приглашение ${invitation.email}`}><div><strong>{invitation.email}</strong><p>{statusText[invitation.status] ?? invitation.status} · до {new Date(invitation.expiresAt).toLocaleString("ru-KZ")}</p></div>{["PENDING", "EXPIRED"].includes(invitation.status) ? <div className="mp-member-actions"><DmButton disabled={busy} onClick={() => void action(async () => { await api.deliverInvitation(organizationId, invitation.id); }, "Приглашение передано на доставку. Предыдущая ссылка больше не действует.")}>Отправить повторно</DmButton><DmButton disabled={busy} onClick={() => setConfirmation({ description: `Отозвать приглашение для ${invitation.email}? Ссылка перестанет работать.`, run: () => api.revokeInvitation(organizationId, invitation.id) })}>Отозвать приглашение</DmButton></div> : null}</article>)}
    </>}
  </section>;
}

function AssignRole({ roles, disabled, onAssign }: { roles: IdentityRole[]; disabled: boolean; onAssign: (id: string) => Promise<void> }) {
  const [selected, setSelected] = useState("");
  if (!roles.length) return null;
  return <form className="mp-member-actions" onSubmit={event => { event.preventDefault(); if (selected) void onAssign(selected).then(() => setSelected("")); }}><DmField label="Дополнительная роль"><DmSelect value={selected} onChange={event => setSelected(event.target.value)} disabled={disabled}><option value="">Выберите роль</option>{roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</DmSelect></DmField><DmButton type="submit" disabled={disabled || !roles.some(role => role.id === selected)}>Назначить роль</DmButton></form>;
}
