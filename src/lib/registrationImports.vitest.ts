import { describe, expect, it } from "vitest";
import {
  canonicalizeHeader,
  detectRegistrationHeaderRow,
  GENERIC_NAME_HEADERS,
  MAH_HEADERS,
  normalizeRegistrationStatus,
  PRODUCT_NAME_HEADERS,
} from "./registrationImports";

describe("registration import header detection", () => {
  it("finds a registry header after source metadata rows", () => {
    const rows = [
      ["Content type:", "Medicine", "Generated on", "2026-09-04"],
      [],
      [
        "Name of medicine",
        "Medicine status",
        "International non-proprietary name (INN) / common name",
      ],
      ["Example", "Authorised", "example substance"],
    ];
    expect(detectRegistrationHeaderRow(rows)).toBe(2);
  });

  it("recognizes current EMA product, INN, and holder headings", () => {
    expect(PRODUCT_NAME_HEADERS).toContain(
      canonicalizeHeader("Name of medicine") as never,
    );
    expect(GENERIC_NAME_HEADERS).toContain(
      canonicalizeHeader(
        "International non-proprietary name (INN) / common name",
      ) as never,
    );
    expect(MAH_HEADERS).toContain(
      canonicalizeHeader(
        "Marketing authorisation developer / applicant / holder",
      ) as never,
    );
    expect(normalizeRegistrationStatus("Authorised")).toBe("registered");
  });
});
