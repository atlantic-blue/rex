import { describe, expect, it } from "vitest";

import { ParseError, parse } from "./parse.js";

describe("parse", () => {
  it("reads plain characters as literals in a sequence", () => {
    expect(parse("abc")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "literal", char: "b" },
        { kind: "literal", char: "c" },
      ],
    });
  });

  it("reads a dot as any character", () => {
    expect(parse("a.c")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "anyChar" },
        { kind: "literal", char: "c" },
      ],
    });
  });

  it("reads an empty pattern as an empty sequence", () => {
    expect(parse("")).toEqual({ kind: "sequence", items: [] });
  });

  it("reads an escaped dot as a literal dot", () => {
    expect(parse("\\.")).toEqual({
      kind: "sequence",
      items: [{ kind: "literal", char: "." }],
    });
  });

  it("reads an escaped backslash as a literal backslash", () => {
    expect(parse("\\\\")).toEqual({
      kind: "sequence",
      items: [{ kind: "literal", char: "\\" }],
    });
  });

  it("reads an escaped plain character as itself", () => {
    expect(parse("\\a")).toEqual({
      kind: "sequence",
      items: [{ kind: "literal", char: "a" }],
    });
  });
});

describe("a pattern that ends on a backslash", () => {
  it("throws a ParseError", () => {
    expect(() => parse("ab\\")).toThrow(ParseError);
  });

  it("puts the index at the backslash", () => {
    expect.assertions(3);
    try {
      parse("ab\\");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      const error = thrown as ParseError;
      expect(error.index).toBe(2);
      expect(error.message).toBe("a pattern cannot end on a backslash");
    }
  });

  it("puts the index at zero when the backslash is the whole pattern", () => {
    expect.assertions(1);
    try {
      parse("\\");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("puts the index at the second backslash of a pair and a half", () => {
    expect.assertions(1);
    try {
      parse("\\\\\\");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(2);
    }
  });
});
