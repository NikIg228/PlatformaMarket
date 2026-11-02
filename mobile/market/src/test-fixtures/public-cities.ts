import { listDraftComparison, listDraftId, listDraftScope } from "./list-draft";
import type { PublicCity } from "../public-cities-fixture-read";
export const cityScope = listDraftScope, firstCityId = listDraftComparison().offers[0]!.availability[0]!.cityId, secondCityId = listDraftId(6101);
export function cityFixture(): PublicCity[] { return [{ id: firstCityId, nameRu: "SYNTHETIC Алматы", region: { nameRu: "SYNTHETIC регион один" } }, { id: secondCityId, nameRu: "SYNTHETIC Астана", region: { nameRu: "SYNTHETIC регион два" } }]; }
