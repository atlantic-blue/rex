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

describe("a character class", () => {
  it("reads each character as a range whose from and to are equal", () => {
    expect(parse("[abc]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "a", to: "a" },
            { from: "b", to: "b" },
            { from: "c", to: "c" },
          ],
        },
      ],
    });
  });

  it("reads a dash between two characters as one range", () => {
    expect(parse("[a-z]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "a", to: "z" }] }],
    });
  });

  it("reads a leading caret as negation", () => {
    expect(parse("[^abc]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: true,
          ranges: [
            { from: "a", to: "a" },
            { from: "b", to: "b" },
            { from: "c", to: "c" },
          ],
        },
      ],
    });
  });

  it("mixes single characters and ranges", () => {
    expect(parse("[a-cx]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "a", to: "c" },
            { from: "x", to: "x" },
          ],
        },
      ],
    });
  });

  it("holds one character on its own", () => {
    expect(parse("[a]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "a", to: "a" }] }],
    });
  });

  it("stands among literals", () => {
    expect(parse("a[b]c")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "charClass", negated: false, ranges: [{ from: "b", to: "b" }] },
        { kind: "literal", char: "c" },
      ],
    });
  });

  it("reads a dot inside the class as a plain dot", () => {
    expect(parse("[.]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: ".", to: "." }] }],
    });
  });

  it("holds no ranges when the class is empty", () => {
    expect(parse("[]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [] }],
    });
  });
});

describe("a backslash inside a character class", () => {
  it("escapes a closing bracket", () => {
    expect(parse("[\\]]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "]", to: "]" }] }],
    });
  });

  it("escapes a backslash", () => {
    expect(parse("[\\\\]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "\\", to: "\\" }] }],
    });
  });

  it("escapes a dash, so the dash is not a range", () => {
    expect(parse("[a\\-z]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "a", to: "a" },
            { from: "-", to: "-" },
            { from: "z", to: "z" },
          ],
        },
      ],
    });
  });

  it("escapes a character that ends a range", () => {
    expect(parse("[a-\\]]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "a", to: "]" }] }],
    });
  });
});

describe("a caret inside a character class", () => {
  it("is a plain character after the first position", () => {
    expect(parse("[a^]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "a", to: "a" },
            { from: "^", to: "^" },
          ],
        },
      ],
    });
  });

  it("negates only once, so a second caret is a plain character", () => {
    expect(parse("[^^]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: true, ranges: [{ from: "^", to: "^" }] }],
    });
  });
});

describe("a dash inside a character class", () => {
  it("is a plain character at the start", () => {
    expect(parse("[-a]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "-", to: "-" },
            { from: "a", to: "a" },
          ],
        },
      ],
    });
  });

  it("is a plain character at the end", () => {
    expect(parse("[a-]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: false,
          ranges: [
            { from: "a", to: "a" },
            { from: "-", to: "-" },
          ],
        },
      ],
    });
  });

  it("is a plain character at the start of a negated class", () => {
    expect(parse("[^-a]")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "charClass",
          negated: true,
          ranges: [
            { from: "-", to: "-" },
            { from: "a", to: "a" },
          ],
        },
      ],
    });
  });
});

describe("a character class with no closing bracket", () => {
  it("throws a ParseError", () => {
    expect(() => parse("[abc")).toThrow(ParseError);
  });

  it("puts the index at the opening bracket", () => {
    expect.assertions(3);
    try {
      parse("[abc");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      const error = thrown as ParseError;
      expect(error.index).toBe(0);
      expect(error.message).toBe("a character class needs a closing bracket");
    }
  });

  it("puts the index at the opening bracket further into the pattern", () => {
    expect.assertions(1);
    try {
      parse("ab[cd");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(2);
    }
  });

  it("does not close on an escaped bracket", () => {
    expect.assertions(1);
    try {
      parse("[a\\]");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("throws when the pattern ends on a backslash inside the class", () => {
    expect.assertions(1);
    try {
      parse("[a\\");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("throws when the class is only an opening bracket", () => {
    expect.assertions(1);
    try {
      parse("[");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });
});
