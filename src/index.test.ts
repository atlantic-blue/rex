import { describe, expect, it } from "vitest";

import { match } from "./index.js";

describe("match", () => {
  it("is exported as a function", () => {
    expect(typeof match).toBe("function");
  });

  it("refuses to answer until the matcher is built", () => {
    expect(() => match("a", "a")).toThrow("not built yet");
  });
});
