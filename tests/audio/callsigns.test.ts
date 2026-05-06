import { describe, it, expect } from "vitest";
import { icaoToSpoken } from "../../src/audio/callsigns";

describe("icaoToSpoken", () => {
  it("translates DAL891 to Delta eight ninety one", () => {
    expect(icaoToSpoken("DAL891")).toBe("Delta eight ninety one");
  });

  it("translates UAL237 to United two thirty seven", () => {
    expect(icaoToSpoken("UAL237")).toBe("United two thirty seven");
  });

  it("translates SWA42 to Southwest forty two", () => {
    expect(icaoToSpoken("SWA42")).toBe("Southwest forty two");
  });

  it("translates AAL14 to American fourteen", () => {
    expect(icaoToSpoken("AAL14")).toBe("American fourteen");
  });

  it("handles 4-digit flight numbers as digit-pairs (1234 -> twelve thirty four)", () => {
    expect(icaoToSpoken("DAL1234")).toBe("Delta twelve thirty four");
  });

  it("handles a single digit (DAL1 -> Delta one)", () => {
    expect(icaoToSpoken("DAL1")).toBe("Delta one");
  });

  it("speaks each digit when no airline letters are present", () => {
    expect(icaoToSpoken("123")).toBe("one two three");
  });

  it("falls back to letter-by-letter for unknown carriers", () => {
    // ZZZ is not a known airline; speak each letter, then digits as pair.
    expect(icaoToSpoken("ZZZ12")).toBe("Zulu Zulu Zulu twelve");
  });

  it("is whitespace and case tolerant", () => {
    expect(icaoToSpoken("  dal891 ")).toBe("Delta eight ninety one");
  });
});
