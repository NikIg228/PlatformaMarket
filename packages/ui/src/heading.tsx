"use client";
import type { ReactNode, Ref } from "react";
import { DmInfoTip } from "./info-tip";

/** Keep optional context beside its heading, with pointer, keyboard and touch help. */
export function DmHeading({ title, description, level = 2, inline = false, headingRef, tabIndex, size }: {
  title: string;
  description?: ReactNode;
  level?: 1 | 2 | 3;
  inline?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  tabIndex?: number;
  /** Opt-in page title typography; existing workspace headings retain their scale. */
  size?: "page";
}) {
  const Heading = `h${level}` as const;
  return <div className="dm-heading" data-dm-inline={inline || undefined} data-dm-heading-size={size}>
    <Heading className="dm-heading-title" ref={headingRef} tabIndex={tabIndex}>{title}</Heading>
    {description ? <DmInfoTip label={`Подсказка: ${title}`}>{description}</DmInfoTip> : null}
  </div>;
}

/** Separate independent groups within one form surface; fields remain grouped. */
export function DmFormSections({ children }: { children: ReactNode }) {
  return <div className="dm-form-sections">{children}</div>;
}
