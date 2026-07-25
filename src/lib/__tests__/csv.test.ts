import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv } from "../csv";

describe("escapeCsvCell", () => {
  it("wraps plain strings in quotes", () => {
    expect(escapeCsvCell("hello")).toBe('"hello"');
  });
  it("escapes embedded quotes by doubling", () => {
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
  });
  it("serializes objects as JSON", () => {
    expect(escapeCsvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it("renders null/undefined as empty string", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });
});

describe("toCsv", () => {
  it("joins headers and rows with commas and newlines", () => {
    const csv = toCsv(
      ["timestamp", "actor", "action"],
      [
        ["2026-01-01", "hr@ciago.com", "doc.approved"],
        ["2026-01-02", null, "doc.rejected"],
      ],
    );
    expect(csv).toBe(
      [
        "timestamp,actor,action",
        '"2026-01-01","hr@ciago.com","doc.approved"',
        '"2026-01-02","","doc.rejected"',
      ].join("\n"),
    );
  });
});
