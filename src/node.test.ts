import { describe, expect, it } from "vitest";

import type { CharClass, Node, Repeat } from "./node.js";

function mark(node: Repeat): string {
  if (node.least === 0 && node.most === "many") {
    return "*";
  }
  if (node.least === 1 && node.most === "many") {
    return "+";
  }
  if (node.least === 0 && node.most === 1) {
    return "?";
  }
  return `{${String(node.least)},${String(node.most)}}`;
}

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
    case "repeat":
      return `${render(node.item)}${mark(node)}`;
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

describe("the repeat shape", () => {
  it("carries the star as least zero and most many", () => {
    const node: Repeat = {
      kind: "repeat",
      item: { kind: "literal", char: "a" },
      least: 0,
      most: "many",
    };

    expect(node.least).toBe(0);
    expect(node.most).toBe("many");
    expect(render(node)).toBe("a*");
  });

  it("carries the plus as least one and most many", () => {
    const node: Repeat = {
      kind: "repeat",
      item: { kind: "literal", char: "a" },
      least: 1,
      most: "many",
    };

    expect(node.least).toBe(1);
    expect(node.most).toBe("many");
    expect(render(node)).toBe("a+");
  });

  it("carries the question mark as least zero and most one", () => {
    const node: Repeat = {
      kind: "repeat",
      item: { kind: "literal", char: "b" },
      least: 0,
      most: 1,
    };

    expect(node.least).toBe(0);
    expect(node.most).toBe(1);
    expect(render(node)).toBe("b?");
  });

  it("carries a most that is a plain number", () => {
    const node: Repeat = {
      kind: "repeat",
      item: { kind: "literal", char: "a" },
      least: 2,
      most: 4,
    };

    expect(render(node)).toBe("a{2,4}");
  });

  it("carries any node as the item, so a class repeats", () => {
    const node: Repeat = {
      kind: "repeat",
      item: { kind: "charClass", ranges: [{ from: "a", to: "z" }], negated: false },
      least: 1,
      most: "many",
    };

    expect(render(node)).toBe("[a-z]+");
  });

  it("stands beside the other kinds in a sequence", () => {
    const tree: Node = {
      kind: "sequence",
      items: [
        { kind: "literal", char: "a" },
        { kind: "repeat", item: { kind: "literal", char: "b" }, least: 0, most: "many" },
      ],
    };

    expect(render(tree)).toBe("ab*");
  });

  it("repeats the dot", () => {
    const tree: Node = {
      kind: "repeat",
      item: { kind: "anyChar" },
      least: 0,
      most: "many",
    };

    expect(render(tree)).toBe(".*");
  });
});
