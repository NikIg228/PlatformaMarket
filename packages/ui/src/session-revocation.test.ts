import { expect, it } from "vitest";
import { validateSessionRevocation } from "./session-revocation";
const id = "00000000-0000-4000-8000-000000000001";
it("accepts only a revoked receipt for the selected session", () => {
  expect(validateSessionRevocation({ id, status: "REVOKED" }, id)).toEqual({ id, status: "REVOKED" });
});
it.each([null, {}, { sessionId: id, status: "REVOKED" }, { id, status: "ACTIVE" }, { id: "00000000-0000-4000-8000-000000000002", status: "REVOKED" }])("rejects a mismatched or malformed receipt %j", value => {
  expect(() => validateSessionRevocation(value, id)).toThrow("Сервер не подтвердил");
});
