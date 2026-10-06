"use client";
import { DmSearch } from "./dm-search";
import { Spinner } from "@fluentui/react-components";
import { DmButton as Button, DmField as Field, DmSelect as Select } from "./controls";
import {useEffect, useRef, useState} from 'react';
import {createRelationRequestSequence, documentRelationError, type DocumentRelationLoader, type DocumentRelationOption, type DocumentRelationPage} from './document-relations';

export function DocumentRelationSelect({label,searchLabel,hint,required=false,disabled,selected,onSelect,load}: {
  label:string;searchLabel:string;hint:string;required?:boolean;disabled:boolean;
  selected:DocumentRelationOption|null;onSelect:(value:DocumentRelationOption|null)=>void;load:DocumentRelationLoader;
}) {
  const [query,setQuery]=useState('');
  const [page,setPage]=useState<DocumentRelationPage>({items:[],hasMore:false});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const sequence=useRef(createRelationRequestSequence());
  const fetchOptions=async(search:string)=>{
    const request=sequence.current.next();setLoading(true);setError(null);
    try {const result=await load(search.trim());if(sequence.current.current(request))setPage(result);}
    catch(error) {if(sequence.current.current(request)){setPage({items:[],hasMore:false});setError(documentRelationError(error));}}
    finally {if(sequence.current.current(request))setLoading(false);}
  };
  useEffect(()=>{void fetchOptions('');return()=>sequence.current.cancel();},[load]);
  const options=selected&&!page.items.some(option=>option.id===selected.id)?[selected,...page.items]:page.items;
  return <div role="group" aria-label={label} style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr)',minWidth:0,gap:"var(--dm-space-2)",overflowWrap:'anywhere'}}>
    <Field label={searchLabel} hint="По номеру или контрагенту. Введите текст и нажмите «Найти»." >
      <DmSearch value={query} placeholder={label === "Связанный заказ" ? "Найти заказ" : "Найти договор"} maxLength={120} disabled={disabled} pending={loading} onChange={setQuery} onSearch={value=>void fetchOptions(value)} />
    </Field>
    <Field label={label} required={required} hint={hint}>
      <Select style={{minWidth:0,width:'100%',maxWidth:'100%'}} value={selected?.id??''} disabled={disabled} onChange={(_,data)=>onSelect(options.find(option=>option.id===data.value)??null)}>
        <option value="">{required?'Выберите договор':'Без связи с заказом'}</option>
        {options.map(option=><option key={option.id} value={option.id}>{option.label} — {option.description}</option>)}
      </Select>
    </Field>
    {selected?<div role="status">Выбрано: {selected.label}. {selected.description}</div>:null}
    {loading?<Spinner size="tiny" label={`Загружаем: ${label}`} />:error?<div role="alert">{error}</div>:<div role="status">{page.items.length===0?'Ничего не найдено. Измените поиск или сначала создайте нужную запись.':page.hasMore?'Показаны первые 100 результатов. Уточните номер или контрагента.':`Найдено: ${page.items.length}`}</div>}
  </div>;
}
