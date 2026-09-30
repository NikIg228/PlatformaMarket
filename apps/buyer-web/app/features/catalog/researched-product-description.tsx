import descriptions from "../../data/researched-product-descriptions.json";

// Exact identity only: never apply a family description to an unrelated SKU.
export function findResearchedDescription(product: { id: string; name: string }) {
  return descriptions.find(entry => entry.id === product.id && entry.name === product.name);
}

export function ResearchedProductDescription({
  entry,
  className,
  sourceClassName,
}: {
  entry: (typeof descriptions)[number];
  className: string;
  sourceClassName: string;
}) {
  const clarification = /^LM/i.test(entry.name)
    ? "Описание относится к линейке LM-Activator. Поколение, размер и исполнение уточняйте по артикулу поставщика."
    : /Latelux/i.test(entry.name)
      ? "Описание производителя Latus. Оттенок и соответствие артикула поставщика уточняйте при выборе предложения."
      : "Описание относится к линейке товара. Оттенок, упаковку и комплектацию уточняйте в предложении поставщика.";

  return (
    <div className={className}>
      <p>{entry.description}</p>
      <small>{clarification}</small>
      <a className={sourceClassName} href={entry.sourceUrl} target="_blank" rel="noreferrer">
        Информация производителя ↗
      </a>
    </div>
  );
}
