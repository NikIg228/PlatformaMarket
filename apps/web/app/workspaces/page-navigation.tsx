"use client";
import { useState } from "react";
import { DmButton } from "@marketplace/ui";

export function usePageNavigation() {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  return {
    cursor: cursors.at(-1), page: cursors.length,
    next: (cursor: string) => setCursors(previous => [...previous, cursor]),
    previous: () => setCursors(previous => previous.slice(0, -1)),
    reset: () => setCursors([undefined]),
  };
}
export function PageNavigation({ navigation, nextCursor, loading, onRefresh }: {
  navigation: ReturnType<typeof usePageNavigation>; nextCursor?: string | null; loading: boolean; onRefresh: () => void;
}) {
  if (navigation.page === 1 && !nextCursor) return null;
  return <nav aria-label="Страницы списка">
    <DmButton disabled={loading || navigation.page === 1} onClick={navigation.previous}>Предыдущая страница</DmButton>
    <span aria-live="polite"> Страница {navigation.page} </span>
    <DmButton disabled={loading || !nextCursor} onClick={() => nextCursor && navigation.next(nextCursor)}>Следующая страница</DmButton>
    <DmButton disabled={loading} onClick={onRefresh}>К началу списка</DmButton>
  </nav>;
}
