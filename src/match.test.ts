import { describe, expect, it } from "vitest";

import type { Node } from "./node.js";
import { matchNode, matchTree } from "./match.js";

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
