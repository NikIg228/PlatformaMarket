import type { Locale } from "./format-wire";
import { reviewDimensions, type BuyerReviewInput } from "./buyer-review-create";
import { buyerReviewCopy } from "./buyer-review-copy";
import { Button, Stack, Surface, Text } from "./ui/controls";

export function Rating({ label, value, onSelect }: { label: string; value: number | null; onSelect: (value: number) => void }) {
  return <Stack><Text strong>{label}</Text><Stack row>{[1, 2, 3, 4, 5].map(rating => <Button key={rating} label={String(rating)} accessibilityLabel={`${label}: ${rating}`} tone="tab" role="radio" selected={value === rating} onPress={() => onSelect(rating)} />)}</Stack></Stack>;
}
export function Summary({ input, locale }: { input: Pick<BuyerReviewInput, "overallRating" | "dimensions" | "comment">; locale: Locale }) {
  const t = buyerReviewCopy[locale];
  return <Surface><Stack><Text>{t.overall}: {input.overallRating}</Text>{reviewDimensions.map(key => <Text key={key}>{t.dimensions[key]}: {input.dimensions[key]}</Text>)}<Text>{t.comment}: {input.comment ?? ""}</Text></Stack></Surface>;
}
