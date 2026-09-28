import { describe, expect, it } from "vitest";

import { withWwwVariant } from "./origins";

describe("withWwwVariant", () => {
  it("adds the www twin of an apex origin and vice versa", () => {
    expect(withWwwVariant("https://astral-vega.com")).toEqual([
      "https://astral-vega.com",
      "https://www.astral-vega.com",
    ]);
    expect(withWwwVariant("https://www.astral-vega.com/")).toEqual([
      "https://www.astral-vega.com",
      "https://astral-vega.com",
    ]);
    expect(withWwwVariant("http://localhost:3000")).toEqual([
      "http://localhost:3000",
      "http://www.localhost:3000",
    ]);
  });
});
