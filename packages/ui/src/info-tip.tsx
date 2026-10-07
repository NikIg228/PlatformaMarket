"use client";
import { useState } from "react";
import { Popover, PopoverSurface, PopoverTrigger } from "@fluentui/react-components";
import { QuestionCircle20Regular } from "@fluentui/react-icons/svg/question-circle";
import { DmButton } from "./controls";

/** The same help is available by hover, keyboard focus and touch. */
export function DmInfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)} openOnHover withArrow positioning="above">
    <PopoverTrigger disableButtonEnhancement><DmButton appearance="subtle" density="compact" icon={<QuestionCircle20Regular />} aria-label={label} aria-expanded={open} onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setOpen(true); }} /></PopoverTrigger>
    <PopoverSurface className="dm-info-tip" role="note" aria-label={label}>{children}</PopoverSurface>
  </Popover>;
}
