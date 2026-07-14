import { describe, expect, test } from "bun:test";
import { logoShaped } from "../fetch-thumbs";

describe("logoShaped candidate ordering", () => {
  test("a large square og:image logo is logo-suspect (the 1024x1024 Flexell case)", () => {
    expect(logoShaped({ w: 1024, h: 1024 })).toBe(true);
  });

  test("a small square logo is logo-suspect", () => {
    expect(logoShaped({ w: 400, h: 400 })).toBe(true);
  });

  test("a landscape press photograph is not", () => {
    expect(logoShaped({ w: 1200, h: 890 })).toBe(false);
  });

  test("a tall portrait photograph is not", () => {
    expect(logoShaped({ w: 600, h: 900 })).toBe(false);
  });

  test("missing or degenerate dimensions are not", () => {
    expect(logoShaped(null)).toBe(false);
    expect(logoShaped({ w: 0, h: 100 })).toBe(false);
  });
});
