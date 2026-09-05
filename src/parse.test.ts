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

describe("a quantifier", () => {
  it("reads a star as a repeat of least zero and most many", () => {
    expect(parse("a*")).toEqual({
      kind: "sequence",
      items: [
        { kind: "repeat", item: { kind: "literal", char: "a" }, least: 0, most: "many" },
      ],
    });
  });

  it("reads a plus as a repeat of least one and most many", () => {
    expect(parse("a+")).toEqual({
      kind: "sequence",
      items: [
        { kind: "repeat", item: { kind: "literal", char: "a" }, least: 1, most: "many" },
      ],
    });
  });

  it("reads a question mark as a repeat of least zero and most one", () => {
    expect(parse("a?")).toEqual({
      kind: "sequence",
      items: [{ kind: "repeat", item: { kind: "literal", char: "a" }, least: 0, most: 1 }],
    });
  });

  it("applies to the one item before it, not to the whole pattern", () => {
    expect(parse("ab*")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "repeat", item: { kind: "literal", char: "b" }, least: 0, most: "many" },
      ],
    });
  });

  it("applies to a character class", () => {
    expect(parse("[a-z]+")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "repeat",
          item: { kind: "charClass", negated: false, ranges: [{ from: "a", to: "z" }] },
          least: 1,
          most: "many",
        },
      ],
    });
  });

  it("applies to the dot", () => {
    expect(parse(".*")).toEqual({
      kind: "sequence",
      items: [{ kind: "repeat", item: { kind: "anyChar" }, least: 0, most: "many" }],
    });
  });

  it("applies to an escaped character", () => {
    expect(parse("\\.+")).toEqual({
      kind: "sequence",
      items: [
        { kind: "repeat", item: { kind: "literal", char: "." }, least: 1, most: "many" },
      ],
    });
  });

  it("stands among literals on both sides", () => {
    expect(parse("ab?c")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "repeat", item: { kind: "literal", char: "b" }, least: 0, most: 1 },
        { kind: "literal", char: "c" },
      ],
    });
  });

  it("reads an escaped star as a literal star", () => {
    expect(parse("a\\*")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "literal", char: "*" },
      ],
    });
  });

  it("reads a star inside a character class as a plain character", () => {
    expect(parse("[*]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", negated: false, ranges: [{ from: "*", to: "*" }] }],
    });
  });
});

describe("a quantifier with no item before it", () => {
  it("throws a ParseError", () => {
    expect(() => parse("*")).toThrow(ParseError);
    expect(() => parse("+a")).toThrow(ParseError);
    expect(() => parse("?a")).toThrow(ParseError);
  });

  it("puts the index at a leading star", () => {
    expect.assertions(3);
    try {
      parse("*a");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      const error = thrown as ParseError;
      expect(error.index).toBe(0);
      expect(error.message).toBe("a quantifier needs an item before it");
    }
  });

  it("puts the index at a leading plus", () => {
    expect.assertions(1);
    try {
      parse("+");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("puts the index at a leading question mark", () => {
    expect.assertions(1);
    try {
      parse("?");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });
});

describe("a quantifier after another quantifier", () => {
  it("refuses two stars", () => {
    expect.assertions(3);
    try {
      parse("a**");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      const error = thrown as ParseError;
      expect(error.index).toBe(2);
      expect(error.message).toBe("a quantifier cannot follow another quantifier");
    }
  });

  it("refuses a plus after a star", () => {
    expect(() => parse("a*+")).toThrow(ParseError);
  });

  it("refuses a question mark after a star, which would be a lazy quantifier", () => {
    expect(() => parse("a*?")).toThrow(ParseError);
  });

  it("refuses a star after a plus", () => {
    expect(() => parse("a+*")).toThrow(ParseError);
  });

  it("puts the index at the second quantifier further into the pattern", () => {
    expect.assertions(1);
    try {
      parse("ab**");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(3);
    }
  });

  it("takes a quantifier after an escaped star, because the star is a literal", () => {
    expect(parse("\\**")).toEqual({
      kind: "sequence",
      items: [
        { kind: "repeat", item: { kind: "literal", char: "*" }, least: 0, most: "many" },
      ],
    });
  });
});

describe("a group", () => {
  it("reads a parenthesised pattern as a group holding a sequence", () => {
    expect(parse("(ab)")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "group",
          item: {
            kind: "sequence",
            items: [
              { kind: "literal", char: "a" },
              { kind: "literal", char: "b" },
            ],
          },
        },
      ],
    });
  });

  it("gives a quantifier after it the whole group as its item", () => {
    expect(parse("(ab)+")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "repeat",
          item: {
            kind: "group",
            item: {
              kind: "sequence",
              items: [
                { kind: "literal", char: "a" },
                { kind: "literal", char: "b" },
              ],
            },
          },
          least: 1,
          most: "many",
        },
      ],
    });
  });

  it("reads an empty group", () => {
    expect(parse("()")).toEqual({
      kind: "sequence",
      items: [{ kind: "group", item: { kind: "sequence", items: [] } }],
    });
  });

  it("reads a group inside a group", () => {
    expect(parse("((a))")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "group",
          item: {
            kind: "sequence",
            items: [
              {
                kind: "group",
                item: { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
              },
            ],
          },
        },
      ],
    });
  });

  it("reads an escaped parenthesis as a literal", () => {
    expect(parse("\\(")).toEqual({
      kind: "sequence",
      items: [{ kind: "literal", char: "(" }],
    });
  });

  it("holds an alternation, so the bar inside stays inside", () => {
    expect(parse("(a|b)c")).toEqual({
      kind: "sequence",
      items: [
        {
          kind: "group",
          item: {
            kind: "alternate",
            options: [
              { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
              { kind: "sequence", items: [{ kind: "literal", char: "b" }] },
            ],
          },
        },
        { kind: "literal", char: "c" },
      ],
    });
  });
});

describe("a group with no closing parenthesis", () => {
  it("throws a ParseError", () => {
    expect(() => parse("(ab")).toThrow(ParseError);
  });

  it("puts the index at the opening parenthesis", () => {
    expect.assertions(3);
    try {
      parse("(ab");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      const error = thrown as ParseError;
      expect(error.index).toBe(0);
      expect(error.message).toBe("a group needs a closing parenthesis");
    }
  });

  it("puts the index at the opening parenthesis further into the pattern", () => {
    expect.assertions(1);
    try {
      parse("ab(cd");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(2);
    }
  });

  it("puts the index at the outer parenthesis when the outer group is the unclosed one", () => {
    expect.assertions(1);
    try {
      parse("(a(b)");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("does not close on an escaped parenthesis", () => {
    expect.assertions(1);
    try {
      parse("(a\\)");
    } catch (thrown) {
      expect((thrown as ParseError).index).toBe(0);
    }
  });

  it("throws when a closing parenthesis has no group to close", () => {
    expect.assertions(2);
    try {
      parse("ab)c");
    } catch (thrown) {
      const error = thrown as ParseError;
      expect(error.index).toBe(2);
      expect(error.message).toBe("a closing parenthesis has no group to close");
    }
  });

  it("throws when a quantifier opens a group", () => {
    expect.assertions(2);
    try {
      parse("(*)");
    } catch (thrown) {
      const error = thrown as ParseError;
      expect(error.index).toBe(1);
      expect(error.message).toBe("a quantifier needs an item before it");
    }
  });
});

describe("an alternation", () => {
  it("reads the bar as a choice between two sequences", () => {
    expect(parse("a|b")).toEqual({
      kind: "alternate",
      options: [
        { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
        { kind: "sequence", items: [{ kind: "literal", char: "b" }] },
      ],
    });
  });

  it("binds loosest, so ab|cd is ab or cd", () => {
    expect(parse("ab|cd")).toEqual({
      kind: "alternate",
      options: [
        {
          kind: "sequence",
          items: [
            { kind: "literal", char: "a" },
            { kind: "literal", char: "b" },
          ],
        },
        {
          kind: "sequence",
          items: [
            { kind: "literal", char: "c" },
            { kind: "literal", char: "d" },
          ],
        },
      ],
    });
  });

  it("reads three options in order", () => {
    expect(parse("a|b|c")).toEqual({
      kind: "alternate",
      options: [
        { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
        { kind: "sequence", items: [{ kind: "literal", char: "b" }] },
        { kind: "sequence", items: [{ kind: "literal", char: "c" }] },
      ],
    });
  });

  it("allows an empty option after the bar", () => {
    expect(parse("a|")).toEqual({
      kind: "alternate",
      options: [
        { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
        { kind: "sequence", items: [] },
      ],
    });
  });

  it("allows an empty option before the bar", () => {
    expect(parse("|a")).toEqual({
      kind: "alternate",
      options: [
        { kind: "sequence", items: [] },
        { kind: "sequence", items: [{ kind: "literal", char: "a" }] },
      ],
    });
  });

  it("gives a quantifier only the item before it, not the whole option", () => {
    expect(parse("ab*|c")).toEqual({
      kind: "alternate",
      options: [
        {
          kind: "sequence",
          items: [
            { kind: "literal", char: "a" },
            { kind: "repeat", item: { kind: "literal", char: "b" }, least: 0, most: "many" },
          ],
        },
        { kind: "sequence", items: [{ kind: "literal", char: "c" }] },
      ],
    });
  });

  it("reads an escaped bar as a literal", () => {
    expect(parse("a\\|b")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "literal", char: "|" },
        { kind: "literal", char: "b" },
      ],
    });
  });

  it("leaves a pattern with no bar as a plain sequence", () => {
    expect(parse("ab")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "literal", char: "b" },
      ],
    });
  });
});

describe("an anchor", () => {
  it("reads the caret as a start anchor", () => {
    expect(parse("^a")).toEqual({
      kind: "sequence",
      items: [
        { kind: "anchor", at: "start" },
        { kind: "literal", char: "a" },
      ],
    });
  });

  it("reads the dollar as an end anchor", () => {
    expect(parse("a$")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "anchor", at: "end" },
      ],
    });
  });

  it("reads both ends of a pattern", () => {
    expect(parse("^abc$")).toEqual({
      kind: "sequence",
      items: [
        { kind: "anchor", at: "start" },
        { kind: "literal", char: "a" },
        { kind: "literal", char: "b" },
        { kind: "literal", char: "c" },
        { kind: "anchor", at: "end" },
      ],
    });
  });

  it("reads an escaped caret and an escaped dollar as literals", () => {
    expect(parse("\\^\\$")).toEqual({
      kind: "sequence",
      items: [
        { kind: "literal", char: "^" },
        { kind: "literal", char: "$" },
      ],
    });
  });

  it("reads a caret inside a class as negation, not as an anchor", () => {
    expect(parse("[^a]")).toEqual({
      kind: "sequence",
      items: [{ kind: "charClass", ranges: [{ from: "a", to: "a" }], negated: true }],
    });
  });

  it("anchors each option of an alternation on its own", () => {
    expect(parse("^a|b$")).toEqual({
      kind: "alternate",
      options: [
        {
          kind: "sequence",
          items: [
            { kind: "anchor", at: "start" },
            { kind: "literal", char: "a" },
          ],
        },
        {
          kind: "sequence",
          items: [
            { kind: "literal", char: "b" },
            { kind: "anchor", at: "end" },
          ],
        },
      ],
    });
  });
});
