"use client";
import { useState } from "react";
import type { ConversationContextInfo } from "@marketplace/schemas";

export function ConversationContext({ context, href }: { context: ConversationContextInfo; href?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="dm-conversation-context">
    {context.imageUrl && !failed ? <img src={context.imageUrl} alt="" onError={() => setFailed(true)} /> : null}
    <div><strong>{context.counterpartyName}</strong>
      {href ? <a href={href}>{context.productName ?? context.title}</a> : <span>{context.productName ?? context.title}</span>}
      {context.variantLabel || context.packagingLabel ? <small>{[context.variantLabel, context.packagingLabel].filter(Boolean).join(" · ")}</small> : null}
    </div>
  </div>;
}
