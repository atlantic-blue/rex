import { describe, expect, it } from "vitest";

import type { Node } from "./node.js";
import { matchNode, matchTree } from "./match.js";
import { parse } from "./parse.js";

const abc: Node = {
  kind: "sequence",
  items: [
    { kind: "literal", char: "a" },
    { kind: "literal", char: "b" },
    { kind: "literal", char: "c" },
  ],
};

const aAnyC: Node = {
  kind: "sequence",
  items: [
    { kind: "literal", char: "a" },
    { kind: "anyChar" },
    { kind: "literal", char: "c" },
  ],
};

describe("matchNode", () => {
  it("answers the next position when a literal is there", () => {
    expect(matchNode({ kind: "literal", char: "b" }, "abc", 1)).toBe(2);
  });

  it("answers nothing when a literal is not there", () => {
    expect(matchNode({ kind: "literal", char: "b" }, "abc", 0)).toBeUndefined();
  });

  it("answers nothing when a literal runs past the end of the input", () => {
    expect(matchNode({ kind: "literal", char: "c" }, "abc", 3)).toBeUndefined();
  });

  it("takes one character for a dot", () => {
    expect(matchNode({ kind: "anyChar" }, "abc", 1)).toBe(2);
  });

  it("answers nothing for a dot at the end of the input", () => {
    expect(matchNode({ kind: "anyChar" }, "abc", 3)).toBeUndefined();
  });

  it("walks the items of a sequence in order", () => {
    expect(matchNode(abc, "abc", 0)).toBe(3);
  });

  it("stops at the first item of a sequence that does not match", () => {
    expect(matchNode(abc, "abd", 0)).toBeUndefined();
  });

  it("takes nothing for an empty sequence", () => {
    expect(matchNode({ kind: "sequence", items: [] }, "abc", 2)).toBe(2);
  });
});

describe("matchTree", () => {
  it("answers true when the tree matches the whole input", () => {
    expect(matchTree(abc, "abc")).toBe(true);
  });

  it("answers true when the tree matches part of the input", () => {
    expect(matchTree(abc, "xxabcxx")).toBe(true);
  });

  it("answers false when the tree matches nowhere", () => {
    expect(matchTree(abc, "abd")).toBe(false);
  });

  it("lets a dot stand for one character", () => {
    expect(matchTree(aAnyC, "abc")).toBe(true);
  });

  it("makes a dot take a character rather than none", () => {
    expect(matchTree(aAnyC, "ac")).toBe(false);
  });

  it("answers true for an empty tree against an empty input", () => {
    expect(matchTree({ kind: "sequence", items: [] }, "")).toBe(true);
  });
});

const lower: Node = {
  kind: "charClass",
  ranges: [{ from: "a", to: "z" }],
  negated: false,
};

const notABC: Node = {
  kind: "charClass",
  ranges: [
    { from: "a", to: "a" },
    { from: "b", to: "b" },
    { from: "c", to: "c" },
  ],
  negated: true,
};

describe("matchNode against a character class", () => {
  it("takes a character inside the range", () => {
    expect(matchNode(lower, "q", 0)).toBe(1);
  });

  it("takes the first character of the range", () => {
    expect(matchNode(lower, "a", 0)).toBe(1);
  });

  it("takes the last character of the range", () => {
    expect(matchNode(lower, "z", 0)).toBe(1);
  });

  it("answers nothing for the character below the range", () => {
    expect(matchNode(lower, "`", 0)).toBeUndefined();
  });

  it("answers nothing for the character above the range", () => {
    expect(matchNode(lower, "{", 0)).toBeUndefined();
  });

  it("answers nothing for an upper case letter", () => {
    expect(matchNode(lower, "Q", 0)).toBeUndefined();
  });

  it("answers nothing at the end of the input", () => {
    expect(matchNode(lower, "ab", 2)).toBeUndefined();
  });

  it("reads the character at the position it is given", () => {
    expect(matchNode(lower, "1a1", 1)).toBe(2);
    expect(matchNode(lower, "1a1", 0)).toBeUndefined();
  });

  it("takes a character outside a negated class", () => {
    expect(matchNode(notABC, "d", 0)).toBe(1);
  });

  it("answers nothing for a character inside a negated class", () => {
    expect(matchNode(notABC, "a", 0)).toBeUndefined();
  });

  it("answers nothing for a negated class at the end of the input", () => {
    expect(matchNode(notABC, "", 0)).toBeUndefined();
  });

  it("takes any character when the class holds no ranges and is negated", () => {
    expect(matchNode({ kind: "charClass", ranges: [], negated: true }, "a", 0)).toBe(1);
  });

  it("answers nothing when the class holds no ranges", () => {
    expect(matchNode({ kind: "charClass", ranges: [], negated: false }, "a", 0)).toBeUndefined();
  });

  it("takes a character held by any one of the ranges", () => {
    const mixed: Node = {
      kind: "charClass",
      ranges: [
        { from: "a", to: "c" },
        { from: "x", to: "x" },
      ],
      negated: false,
    };

    expect(matchNode(mixed, "b", 0)).toBe(1);
    expect(matchNode(mixed, "x", 0)).toBe(1);
    expect(matchNode(mixed, "m", 0)).toBeUndefined();
  });
});

describe("a class parsed from a pattern", () => {
  function matches(pattern: string, input: string): boolean {
    return matchTree(parse(pattern), input);
  }

  it("matches one lower case letter and nothing else", () => {
    expect(matches("[a-z]", "q")).toBe(true);
    expect(matches("[a-z]", "a")).toBe(true);
    expect(matches("[a-z]", "z")).toBe(true);
    expect(matches("[a-z]", "Q")).toBe(false);
    expect(matches("[a-z]", "1")).toBe(false);
    expect(matches("[a-z]", "")).toBe(false);
  });

  it("takes one character only, not two", () => {
    expect(matches("x[a-z]y", "xqy")).toBe(true);
    expect(matches("x[a-z]y", "xqqy")).toBe(false);
    expect(matches("x[a-z]y", "xy")).toBe(false);
  });

  it("matches d for a negated class and does not match a", () => {
    expect(matches("[^abc]", "d")).toBe(true);
    expect(matches("[^abc]", "a")).toBe(false);
  });

  it("mixes single characters and ranges", () => {
    expect(matches("[a-cx]", "b")).toBe(true);
    expect(matches("[a-cx]", "x")).toBe(true);
    expect(matches("[a-cx]", "m")).toBe(false);
  });

  it("answers the same as a literal when the class holds one character", () => {
    expect(matches("[a]", "a")).toBe(matches("a", "a"));
    expect(matches("[a]", "b")).toBe(matches("a", "b"));
    expect(matches("[a]", "a")).toBe(true);
    expect(matches("[a]", "b")).toBe(false);
  });

  it("matches a closing bracket when the class escapes it", () => {
    expect(matches("[\\]]", "]")).toBe(true);
    expect(matches("[\\]]", "a")).toBe(false);
  });

  it("matches the caret when the caret is not first", () => {
    expect(matches("[a^]", "^")).toBe(true);
    expect(matches("[a^]", "a")).toBe(true);
    expect(matches("[a^]", "b")).toBe(false);
  });

  it("matches the dash when the dash is first", () => {
    expect(matches("[-a]", "-")).toBe(true);
    expect(matches("[-a]", "a")).toBe(true);
    expect(matches("[-a]", "b")).toBe(false);
  });

  it("matches the dash when the dash is last", () => {
    expect(matches("[a-]", "-")).toBe(true);
    expect(matches("[a-]", "a")).toBe(true);
    expect(matches("[a-]", "b")).toBe(false);
  });

  it("finds a class anywhere in the input", () => {
    expect(matches("[0-9]", "abc7def")).toBe(true);
    expect(matches("[0-9]", "abcdef")).toBe(false);
  });
});

const aStar: Node = {
  kind: "repeat",
  item: { kind: "literal", char: "a" },
  least: 0,
  most: "many",
};

describe("matchNode against a repeat", () => {
  it("takes every character it can on the first answer", () => {
    expect(matchNode(aStar, "aaa", 0)).toBe(3);
  });

  it("takes nothing when the item is not there and least is zero", () => {
    expect(matchNode(aStar, "bbb", 0)).toBe(0);
  });

  it("takes nothing at the end of the input", () => {
    expect(matchNode(aStar, "aaa", 3)).toBe(3);
  });

  it("answers nothing when least is one and the item is not there", () => {
    const aPlus: Node = { ...aStar, least: 1 };

    expect(matchNode(aPlus, "bbb", 0)).toBeUndefined();
  });

  it("stops at most when most is a number", () => {
    const aOnce: Node = { ...aStar, most: 1 };

    expect(matchNode(aOnce, "aaa", 0)).toBe(1);
  });

  it("reads the item from the position it is given", () => {
    expect(matchNode(aStar, "bbaa", 2)).toBe(4);
  });
});

describe("a quantifier parsed from a pattern", () => {
  function matches(pattern: string, input: string): boolean {
    return matchTree(parse(pattern), input);
  }

  it("matches the empty string with a star", () => {
    expect(matches("a*", "")).toBe(true);
  });

  it("does not match the empty string with a plus", () => {
    expect(matches("a+", "")).toBe(false);
  });

  it("needs one item for a plus and takes many", () => {
    expect(matches("xa+y", "xy")).toBe(false);
    expect(matches("xa+y", "xay")).toBe(true);
    expect(matches("xa+y", "xaaay")).toBe(true);
  });

  it("gives a character back so that a star and a literal share the input", () => {
    expect(matches("a*a", "aa")).toBe(true);
    expect(matches("a*a", "a")).toBe(true);
    expect(matches("a*a", "aaaa")).toBe(true);
    expect(matches("a*a", "")).toBe(false);
  });

  it("gives back more than one character when the rest of the pattern needs them", () => {
    expect(matches("xa*aay", "xaaay")).toBe(true);
    expect(matches("xa*aay", "xaay")).toBe(true);
    expect(matches("xa*aay", "xay")).toBe(false);
  });

  it("takes the item or leaves it out for a question mark", () => {
    expect(matches("ab?c", "abc")).toBe(true);
    expect(matches("ab?c", "ac")).toBe(true);
  });

  it("takes at most one item for a question mark", () => {
    expect(matches("xab?cy", "xabbcy")).toBe(false);
  });

  it("applies to one item, so a star after a literal leaves the literal alone", () => {
    expect(matches("ab*", "a")).toBe(true);
    expect(matches("ab*", "abbb")).toBe(true);
    expect(matches("xab*y", "xy")).toBe(false);
    expect(matches("xab*y", "xay")).toBe(true);
    expect(matches("xab*y", "xabbby")).toBe(true);
  });

  it("repeats a character class", () => {
    expect(matches("[a-z]+", "abc")).toBe(true);
    expect(matches("x[a-z]+y", "xabcy")).toBe(true);
    expect(matches("x[a-z]+y", "xy")).toBe(false);
    expect(matches("x[a-z]+y", "x1y")).toBe(false);
  });

  it("repeats the dot", () => {
    expect(matches("x.*y", "xy")).toBe(true);
    expect(matches("x.*y", "xanythingy")).toBe(true);
  });

  it("finds a repeat anywhere in the input", () => {
    expect(matches("a+", "bbaa")).toBe(true);
    expect(matches("a+", "bbb")).toBe(false);
  });

  it("matches a literal star when the star is escaped", () => {
    expect(matches("a\\*", "a*")).toBe(true);
    expect(matches("a\\*", "aaa")).toBe(false);
  });
});

describe("matchNode against a group", () => {
  it("takes what the item takes", () => {
    const node: Node = { kind: "group", item: abc };

    expect(matchNode(node, "abc", 0)).toBe(3);
  });

  it("answers nothing when the item does not match", () => {
    const node: Node = { kind: "group", item: abc };

    expect(matchNode(node, "abd", 0)).toBeUndefined();
  });

  it("takes nothing when the item takes nothing", () => {
    const node: Node = { kind: "group", item: { kind: "sequence", items: [] } };

    expect(matchNode(node, "abc", 1)).toBe(1);
  });
});

describe("matchNode against an alternate", () => {
  const aOrB: Node = {
    kind: "alternate",
    options: [
      { kind: "literal", char: "a" },
      { kind: "literal", char: "b" },
    ],
  };

  it("takes the first option when it matches", () => {
    expect(matchNode(aOrB, "abc", 0)).toBe(1);
  });

  it("takes a later option when the earlier one does not match", () => {
    expect(matchNode(aOrB, "bc", 0)).toBe(1);
  });

  it("takes the first option that matches, not the longest one", () => {
    const shortFirst: Node = {
      kind: "alternate",
      options: [
        { kind: "literal", char: "a" },
        {
          kind: "sequence",
          items: [
            { kind: "literal", char: "a" },
            { kind: "literal", char: "b" },
          ],
        },
      ],
    };

    expect(matchNode(shortFirst, "ab", 0)).toBe(1);
  });

  it("answers nothing when no option matches", () => {
    expect(matchNode(aOrB, "c", 0)).toBeUndefined();
  });

  it("answers nothing for no options at all", () => {
    expect(matchNode({ kind: "alternate", options: [] }, "a", 0)).toBeUndefined();
  });
});

describe("matchNode against an anchor", () => {
  it("takes nothing at the start of the input for a start anchor", () => {
    expect(matchNode({ kind: "anchor", at: "start" }, "abc", 0)).toBe(0);
  });

  it("answers nothing away from the start for a start anchor", () => {
    expect(matchNode({ kind: "anchor", at: "start" }, "abc", 1)).toBeUndefined();
  });

  it("takes nothing at the end of the input for an end anchor", () => {
    expect(matchNode({ kind: "anchor", at: "end" }, "abc", 3)).toBe(3);
  });

  it("answers nothing away from the end for an end anchor", () => {
    expect(matchNode({ kind: "anchor", at: "end" }, "abc", 2)).toBeUndefined();
  });

  it("holds both anchors at once against an empty input", () => {
    expect(matchNode({ kind: "anchor", at: "start" }, "", 0)).toBe(0);
    expect(matchNode({ kind: "anchor", at: "end" }, "", 0)).toBe(0);
  });
});

describe("a group parsed from a pattern", () => {
  function matches(pattern: string, input: string): boolean {
    return matchTree(parse(pattern), input);
  }

  it("repeats the whole pair under a quantifier", () => {
    expect(matches("(ab)+", "abab")).toBe(true);
    expect(matches("(ab)+", "ab")).toBe(true);
    expect(matches("(ab)+", "aba")).toBe(true);
    expect(matches("(ab)+", "ba")).toBe(false);
  });

  it("needs one whole pair for a plus", () => {
    expect(matches("^(ab)+$", "abab")).toBe(true);
    expect(matches("^(ab)+$", "aba")).toBe(false);
    expect(matches("^(ab)+$", "")).toBe(false);
  });

  it("takes no pair at all under a star", () => {
    expect(matches("^(ab)*$", "")).toBe(true);
    expect(matches("^(ab)*$", "abab")).toBe(true);
  });

  it("groups without changing what a plain pattern matches", () => {
    expect(matches("(abc)", "abc")).toBe(true);
    expect(matches("(a)(b)", "ab")).toBe(true);
  });

  it("ends a repeat whose group takes nothing", () => {
    expect(matches("(a|)*b", "b")).toBe(true);
    expect(matches("^(a|)*$", "aa")).toBe(true);
  });
});

describe("an alternation parsed from a pattern", () => {
  function matches(pattern: string, input: string): boolean {
    return matchTree(parse(pattern), input);
  }

  it("matches either side of the bar", () => {
    expect(matches("a|b", "a")).toBe(true);
    expect(matches("a|b", "b")).toBe(true);
    expect(matches("a|b", "c")).toBe(false);
  });

  it("binds loosest, so ab|cd is ab or cd", () => {
    expect(matches("ab|cd", "ab")).toBe(true);
    expect(matches("ab|cd", "cd")).toBe(true);
    expect(matches("^(ab|cd)$", "acd")).toBe(false);
    expect(matches("^(ab|cd)$", "abd")).toBe(false);
  });

  it("chooses inside a group, so each option carries the rest of the pattern", () => {
    expect(matches("(a|b)c", "ac")).toBe(true);
    expect(matches("(a|b)c", "bc")).toBe(true);
    expect(matches("(a|b)c", "cc")).toBe(false);
  });

  it("matches the empty string on an empty option", () => {
    expect(matches("a|", "")).toBe(true);
    expect(matches("^(a|)$", "")).toBe(true);
    expect(matches("^(a|)$", "a")).toBe(true);
  });

  it("takes a later option when the first one leaves the rest unmatched", () => {
    expect(matches("^(a|ab)c$", "abc")).toBe(true);
    expect(matches("^(ab|a)c$", "ac")).toBe(true);
  });

  it("reads three options", () => {
    expect(matches("^(cat|dog|fish)$", "dog")).toBe(true);
    expect(matches("^(cat|dog|fish)$", "fish")).toBe(true);
    expect(matches("^(cat|dog|fish)$", "bird")).toBe(false);
  });

  it("repeats a whole alternation under a quantifier", () => {
    expect(matches("^(a|b)+$", "abba")).toBe(true);
    expect(matches("^(a|b)+$", "abca")).toBe(false);
  });
});

describe("an anchor parsed from a pattern", () => {
  function matches(pattern: string, input: string): boolean {
    return matchTree(parse(pattern), input);
  }

  it("binds the match to both ends of the input", () => {
    expect(matches("^abc$", "abc")).toBe(true);
    expect(matches("^abc$", "xabc")).toBe(false);
    expect(matches("^abc$", "abcx")).toBe(false);
  });

  it("binds the start and leaves the end free", () => {
    expect(matches("^abc", "abcd")).toBe(true);
    expect(matches("^abc", "xabc")).toBe(false);
  });

  it("binds the end and leaves the start free", () => {
    expect(matches("abc$", "xabc")).toBe(true);
    expect(matches("abc$", "abcx")).toBe(false);
  });

  it("matches an empty input on both anchors together", () => {
    expect(matches("^$", "")).toBe(true);
    expect(matches("^$", "a")).toBe(false);
  });

  it("holds a quantifier between the anchors", () => {
    expect(matches("^a*$", "aaa")).toBe(true);
    expect(matches("^a*$", "")).toBe(true);
    expect(matches("^a*$", "aab")).toBe(false);
  });

  it("anchors each option of an alternation on its own", () => {
    expect(matches("^a|b$", "axx")).toBe(true);
    expect(matches("^a|b$", "xxb")).toBe(true);
    expect(matches("^a|b$", "xax")).toBe(false);
  });

  it("reads an escaped caret and an escaped dollar as literals", () => {
    expect(matches("\\^a", "^a")).toBe(true);
    expect(matches("a\\$", "a$")).toBe(true);
  });
});
