import { describe, expect, it } from "vitest";

import type { Node } from "./node.js";

function render(node: Node): string {
  switch (node.kind) {
    case "literal":
      return node.char;
    case "anyChar":
      return ".";
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
