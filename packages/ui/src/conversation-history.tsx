"use client";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ConversationDetail } from "@marketplace/schemas";
import { DmButton } from "./controls";
import { SupportAttachmentList } from "./support-files";
import type { ConversationFilesApi } from "./conversation-composer";

const day = (value: string) => new Intl.DateTimeFormat("ru-KZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("ru-KZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
export function ConversationHistory({ api, detail, organizationId, busy, onOlder, onRead, sent }: {
  api: ConversationFilesApi; detail: ConversationDetail | null; organizationId: string; busy: boolean;
  onOlder: () => void; onRead: (sequence: number) => void; sent: number;
}) {
  const scroll = useRef<HTMLDivElement>(null), following = useRef(true);
  const previous = useRef({ first: 0, last: 0, height: 0, sent: 0 });
  const [newMessages, setNewMessages] = useState(false);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const observer = new ResizeObserver(() => { if (following.current) node.scrollTop = node.scrollHeight; });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const filesApi = useMemo(() => ({ uploadSupportAttachment: async () => { throw new Error("Unavailable"); }, downloadSupportAttachment: api.downloadConversationAttachment.bind(api) }), [api]);
  useLayoutEffect(() => {
    const node = scroll.current;
    if (!node || !detail) return;
    const first = detail.messages[0]?.sequence ?? 0, last = detail.conversation.latestSequence;
    const old = previous.current;
    if (old.first && first < old.first) node.scrollTop += node.scrollHeight - old.height;
    else if (following.current || sent !== old.sent) { node.scrollTop = node.scrollHeight; following.current = true; setNewMessages(false); onRead(last); }
    else if (last > old.last) setNewMessages(true);
    previous.current = { first, last, height: node.scrollHeight, sent };
  }, [detail, sent, onRead]);
  return <div className="dm-conversation-reading">
    <div className="dm-conversation-scroll" ref={scroll} tabIndex={0} aria-label="История сообщений" onScroll={() => {
      const node = scroll.current!; following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
      if (following.current) { setNewMessages(false); if (detail) onRead(detail.conversation.latestSequence); }
    }}>
      {detail?.hasOlder ? <DmButton disabled={busy} onClick={onOlder}>Ранние сообщения</DmButton> : null}
      <ol className="dm-conversations-history" aria-label="История сообщений">{detail?.messages.map((message, index) => {
        const own = message.authorOrganizationId === organizationId;
        const date = day(message.createdAt);
        return <Fragment key={message.id}>{index === 0 || date !== day(detail.messages[index - 1].createdAt) ? <li className="dm-conversation-date">{date}</li> : null}
          <li className="dm-conversation-message" data-own={own}>
            <strong>{message.authorName} · {message.authorRole === "OPERATOR" ? "Оператор площадки" : message.authorRole === "BUYER" ? "Клиника" : "Поставщик"}</strong>
            {message.body ? <p>{message.body}</p> : null}
            <SupportAttachmentList api={filesApi} ticketId={detail.conversation.id} messageId={message.id} files={message.attachments ?? null} />
            <small>{time(message.createdAt)}{own ? ` · ${message.readByCounterparty ? "Прочитано представителем компании" : "Отправлено"}` : ""}</small>
          </li></Fragment>;
      })}</ol>
    </div>
    {newMessages ? <div className="dm-conversation-new"><DmButton onClick={() => { following.current = true; scroll.current?.scrollTo({ top: scroll.current.scrollHeight }); setNewMessages(false); if (detail) onRead(detail.conversation.latestSequence); }}>К новым сообщениям</DmButton></div> : null}
  </div>;
}
