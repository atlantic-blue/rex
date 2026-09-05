import type { Node } from "./node.js";

export function matchTree(tree: Node, input: string): boolean {
  for (let start = 0; start <= input.length; start += 1) {
    if (matchNode(tree, input, start) !== undefined) {
      return true;
    }
  }
  return false;
}

export function matchNode(node: Node, input: string, at: number): number | undefined {
  switch (node.kind) {
    case "literal":
      return at < input.length && input.charAt(at) === node.char ? at + 1 : undefined;
    case "anyChar":
      return at < input.length ? at + 1 : undefined;
    case "charClass": {
      if (at >= input.length) {
        return undefined;
      }
      const char = input.charAt(at);
      const held = node.ranges.some((range) => range.from <= char && char <= range.to);
      return held === node.negated ? undefined : at + 1;
    }
    case "sequence": {
      let now = at;
      for (const item of node.items) {
        const next = matchNode(item, input, now);
        if (next === undefined) {
          return undefined;
        }
        now = next;
      }
      return now;
    }
  }
}
