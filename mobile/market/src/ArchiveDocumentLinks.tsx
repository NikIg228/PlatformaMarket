import type { Locale } from "./format-wire";
import type { ArchiveBaseSelection, ArchiveDocumentLinks as Links } from "./document-archive-links";
import { Button, Notice, Stack, Text } from "./ui/controls";
export const archiveLinksCopy = {
  ru: { backToParent: "Вернуться к исходному документу", title: "Связи документа", baseOpen: "Прочитать базовый договор", baseNone: "Базовый документ не указан", baseUnknown: "Связь с базовым документом не подтверждена", cycle: "Циклическая ссылка на документ", cycleBody: "Повторный переход по этой цепочке недоступен.", orderNone: "Связанный заказ не указан", orderUnknown: "Связь с заказом текущего покупателя не подтверждена", orderUnsupported: "Переход к заказу пока недоступен", orderBody: "Для перехода пока недостаточно подтверждённых данных о связи.", boundary: "Связанный объект читается отдельно. Доступ и актуальная связь проверяются повторно.", changed: "Связь документа не подтверждена", changedBody: "Исходная запись изменилась или связанная цель не соответствует ей. Вернитесь к исходной карточке и обновите её." },
  kk: { backToParent: "Бастапқы құжатқа оралу", title: "Құжат байланыстары", baseOpen: "Негізгі шартты оқу", baseNone: "Негізгі құжат көрсетілмеген", baseUnknown: "Негізгі құжатпен байланыс расталмаған", cycle: "Құжатқа циклдік сілтеме", cycleBody: "Бұл тізбек бойынша қайта өту қолжетімсіз.", orderNone: "Байланысты тапсырыс көрсетілмеген", orderUnknown: "Ағымдағы сатып алушының тапсырысымен байланыс расталмаған", orderUnsupported: "Тапсырысқа өту әзірше қолжетімсіз", orderBody: "Өту үшін байланыс туралы расталған деректер әзірше жеткіліксіз.", boundary: "Байланысты нысан бөлек оқылады. Қолжетімділік пен ағымдағы байланыс қайта тексеріледі.", changed: "Құжат байланысы расталмаған", changedBody: "Бастапқы жазба өзгерген немесе байланысты нысан оған сәйкес келмейді. Бастапқы карточкаға оралып, оны жаңартыңыз." },
} as const;
export function ArchiveDocumentLinks({ links, locale, onOpen }: { links: Links; locale: Locale; onOpen: (target: ArchiveBaseSelection) => void }) {
  const t = archiveLinksCopy[locale], { base, order } = links;
  return <Stack><Text kind="subtitle">{t.title}</Text><Text secondary>{t.boundary}</Text>
    {base.state === "available" ? <Button label={t.baseOpen} onPress={() => onOpen(base.target)} /> : base.state === "cycle" ? <Notice title={t.cycle} body={t.cycleBody} /> : <Text secondary>{base.state === "none" ? t.baseNone : t.baseUnknown}</Text>}
    {order.state === "unsupported" ? <Notice title={t.orderUnsupported} body={t.orderBody} /> : <Text secondary>{order.state === "none" ? t.orderNone : t.orderUnknown}</Text>}
  </Stack>;
}
