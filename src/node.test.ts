import { describe, expect, it } from "vitest";

import type { CharClass, Node } from "./node.js";

function render(node: Node): string {
  switch (node.kind) {
    case "literal":
      return node.char;
    case "anyChar":
      return ".";
    case "charClass": {
      const body = node.ranges
        .map((range) => (range.from === range.to ? range.from : `${range.from}-${range.to}`))
        .join("");
      return `[${node.negated ? "^" : ""}${body}]`;
    }
    case "sequence":
      return node.items.map(render).join("");
  }
}

describe("the node shapes", () => {
  it("tells a literal, a dot and a sequence apart from the kind alone", () => {
    const tree: Node = {
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "anyChar" },
        { kind: "literal", char: "c" },
      ],
    };

    expect(render(tree)).toBe("a.c");
  });

  it("holds a sequence inside a sequence", () => {
    const tree: Node = {
      kind: "sequence",
      items: [{ kind: "sequence", items: [{ kind: "literal", char: "x" }] }],
    };

    expect(render(tree)).toBe("x");
  });

  it("carries an empty sequence with no items", () => {
    const tree: Node = { kind: "sequence", items: [] };

    expect(render(tree)).toBe("");
  });
});

describe("the character class shape", () => {
  it("carries a range as a from and a to", () => {
    const node: CharClass = {
      kind: "charClass",
      ranges: [{ from: "a", to: "z" }],
      negated: false,
    };

    expect(render(node)).toBe("[a-z]");
  });

  it("carries a single character as a range whose from and to are equal", () => {
    const node: CharClass = {
      kind: "charClass",
      ranges: [{ from: "a", to: "a" }],
      negated: false,
    };

    expect(node.ranges).toEqual([{ from: "a", to: "a" }]);
    expect(render(node)).toBe("[a]");
  });

  it("carries negation as a boolean", () => {
    const node: CharClass = {
      kind: "charClass",
      ranges: [{ from: "a", to: "a" }],
      negated: true,
    };

    expect(node.negated).toBe(true);
    expect(render(node)).toBe("[^a]");
  });

  it("holds single characters and ranges together", () => {
    const node: CharClass = {
      kind: "charClass",
      ranges: [
        { from: "a", to: "c" },
        { from: "x", to: "x" },
      ],
      negated: false,
    };

    expect(render(node)).toBe("[a-cx]");
  });

  it("stands beside the other kinds in a sequence", () => {
    const tree: Node = {
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "charClass", ranges: [{ from: "0", to: "9" }], negated: false },
      ],
    };

    expect(render(tree)).toBe("a[0-9]");
  });
});
