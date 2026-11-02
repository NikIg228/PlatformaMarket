import type { CartResponse } from "../../../packages/schemas/src/core-api";

// The workspace page supplies this relationship. Do not derive the recovery ID
// or borrow an old page's pointer for a different cart/detail response.
export function recoveredCartTarget(cart: CartResponse): string | null {
  return cart.status === "ABANDONED" && cart.checkout?.status === "FAILED"
    && !!cart.recoveredCartId && cart.recoveredCartId !== cart.id
    ? cart.recoveredCartId : null;
}

export const recoveredCartCopy = {
  ru: {
    title: "Связанная восстановленная корзина",
    body: "По этой попытке уже есть восстановленная корзина. Можно открыть её текущее состояние. Перед новой покупкой условия требуют отдельной проверки.",
    open: "Открыть восстановленную корзину",
    invalid: "Связь с восстановленной корзиной не подтверждена",
  },
  kk: {
    title: "Байланысты қалпына келтірілген себет",
    body: "Осы әрекетке қатысты қалпына келтірілген себет бар. Оның ағымдағы күйін ашуға болады. Жаңа сатып алу алдында шарттарды бөлек тексеру қажет.",
    open: "Қалпына келтірілген себетті ашу",
    invalid: "Қалпына келтірілген себетпен байланыс расталмаған",
  },
} as const;
