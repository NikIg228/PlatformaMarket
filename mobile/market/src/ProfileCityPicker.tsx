import { useMemo, useRef, useState } from "react";
import type { Locale } from "./format-wire";
import type { OrganizationProfileEdit, OrganizationProfileState } from "./organization-profile-edit";
import { cityCopy } from "./DeliveryCityRead";
import { Button, FormInput, Loading, Stack, Surface, Text } from "./ui/controls";
const pageSize = 20;
export const profileCityPickerCopy = {
  ru: { next: "Следующие города", previous: "Предыдущие города", page: "Страница", matches: "Совпадений в прочитанном справочнике" },
  kk: { next: "Келесі қалалар", previous: "Алдыңғы қалалар", page: "Бет", matches: "Оқылған анықтамалықтағы сәйкестіктер" },
} as const;
export function ProfileCityPicker({ model, state, kind, locale, title, searchLabel, emptyLabel, closeLabel, onClose }: { model: OrganizationProfileEdit; state: OrganizationProfileState; kind: "legalAddress" | "deliveryAddress"; locale: Locale; title: string; searchLabel: string; emptyLabel: string; closeLabel: string; onClose: () => void }) {
  const [search,setSearch] = useState(""), [page,setPage] = useState(0), [selection,setSelection] = useState<{ start: number; end: number }>();
  const live = useRef<object>({}), frame = {}; live.current = frame;
  const rows = useMemo(() => { const q=search.trim().toLowerCase(); return q ? state.cities.filter(city => `${city.nameRu} ${city.region.nameRu}`.toLowerCase().includes(q)) : state.cities; },[state.cities,search]);
  const current = () => live.current === frame && model.available() && model.getSnapshot() === state && state.phase === "editing" && !state.citiesPending;
  const pages=Math.max(1,Math.ceil(rows.length/pageSize)), position=Math.min(page,pages-1), t=profileCityPickerCopy[locale];
  if (!model.available() || state.phase !== "editing" || !state.draft) return null;
  if (state.citiesPending) return <Loading label={cityCopy[locale].title} />;
  return <Surface><Text strong>{title}</Text><Text secondary>{cityCopy[locale].names}</Text>
    <FormInput accessibilityLabel={searchLabel} value={search} selection={selection} maxLength={240} autoCorrect={false} onChangeText={value=>{if(!current())return;setSearch(value);setPage(0);setSelection(undefined);}} onSelectionChange={event=>{const range=event.nativeEvent.selection;if(current()&&Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.end>=range.start&&range.end<=search.length)setSelection({start:range.start,end:range.end});}} />
    <Text secondary>{t.page} {position+1}/{pages} · {t.matches}: {rows.length}</Text>
    {rows.slice(position*pageSize,(position+1)*pageSize).map(city=><Button key={city.id} role="radio" selected={state.draft![kind].cityId===city.id} disabled={!city.nameRu.trim()} label={`${city.nameRu.trim()?city.nameRu:cityCopy[locale].unknown} · ${city.region.nameRu.trim()?city.region.nameRu:cityCopy[locale].regionUnknown}`} onPress={()=>{if(!current()||!state.cities.includes(city))return;model.chooseCity(kind,city);onClose();}} />)}
    {!rows.length&&<Text>{emptyLabel}</Text>}<Stack row><Button label={t.previous} disabled={position===0} onPress={()=>{if(current()&&position>0)setPage(position-1);}} /><Button label={t.next} disabled={position>=pages-1} onPress={()=>{if(current()&&position<pages-1)setPage(position+1);}} /></Stack>
    <Button label={closeLabel} onPress={()=>{if(current())onClose();}} />
  </Surface>;
}
