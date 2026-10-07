import type { OrderWorkflowResponse } from "@marketplace/schemas";

export function OrderSupplierContacts({ contacts }: { contacts: OrderWorkflowResponse["supplierContacts"] }) {
  if (!contacts?.official && !contacts?.reserves.length) return null;
  const rows = [
    ...(contacts.official ? [{ title: "Официальный контакт", contact: contacts.official }] : []),
    ...contacts.reserves.map((contact, index) => ({ title: `Резервный контакт ${index + 1}`, contact })),
  ];
  return <section className="dm-order-card dm-order-contacts" aria-label="Контакты поставщика"><h2>Контакты поставщика</h2>
    {rows.map(({ title, contact }) => <div key={title}><h3>{title}</h3><span>{contact.contactName}</span><a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a><a href={`mailto:${contact.email}`}>{contact.email}</a></div>)}
  </section>;
}
