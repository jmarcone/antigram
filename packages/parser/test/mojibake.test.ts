import { describe, expect, it } from "vitest";
import { fixMojibake, looksMojibake } from "../src/mojibake.js";

describe("fixMojibake", () => {
  it("leaves plain ASCII alone", () => {
    expect(fixMojibake("hello")).toBe("hello");
    expect(fixMojibake("")).toBe("");
  });

  it("leaves correctly-encoded UTF-8 alone", () => {
    expect(fixMojibake("Café")).toBe("Café");
    expect(fixMojibake("naïve")).toBe("naïve");
    expect(fixMojibake("résumé")).toBe("résumé");
    expect(fixMojibake("Sunset 🌅")).toBe("Sunset 🌅");
  });

  it("repairs Meta's UTF-8-as-cp1252 mojibake on Latin chars", () => {
    expect(fixMojibake("CafÃ©")).toBe("Café");
    expect(fixMojibake("naÃ¯ve")).toBe("naïve");
    expect(fixMojibake("rÃ©sumÃ©")).toBe("résumé");
  });

  it("repairs mojibake on emoji (the canonical Meta case)", () => {
    expect(fixMojibake("Sunset over Tempelhof ðŸŒ…")).toBe("Sunset over Tempelhof 🌅");
    expect(fixMojibake("Iconic ðŸ™Œ")).toBe("Iconic 🙌");
  });

  it("declines to 'repair' strings that would decode to invalid UTF-8", () => {
    // ÿÿÿ is valid Latin-1/cp1252 but not valid UTF-8.
    expect(fixMojibake("ÿÿÿ")).toBe("ÿÿÿ");
  });

  it("handles strings that contain a mix of mojibake and plain text", () => {
    expect(fixMojibake("Hello CafÃ©, see you at 5")).toBe("Hello Café, see you at 5");
  });
});

describe("looksMojibake", () => {
  it("returns true on actual mojibake", () => {
    expect(looksMojibake("CafÃ©")).toBe(true);
    expect(looksMojibake("Sunset ðŸŒ…")).toBe(true);
  });

  it("returns false on correct strings", () => {
    expect(looksMojibake("Café")).toBe(false);
    expect(looksMojibake("hello")).toBe(false);
    expect(looksMojibake("")).toBe(false);
  });
});
