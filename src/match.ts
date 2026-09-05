import type { Node, Repeat } from "./node.js";

export type Rest = (at: number) => boolean;

const reachedTheEnd: Rest = () => true;

export function matchTree(tree: Node, input: string): boolean {
  for (let start = 0; start <= input.length; start += 1) {
    if (matchFrom(tree, input, start, reachedTheEnd)) {
      return true;
    }
  }
  return false;
}

export function matchNode(node: Node, input: string, at: number): number | undefined {
  let reached: number | undefined;

  matchFrom(node, input, at, (end) => {
    reached = end;
    return true;
  });

  return reached;
}

export function matchFrom(node: Node, input: string, at: number, rest: Rest): boolean {
  switch (node.kind) {
    case "literal":
      return at < input.length && input.charAt(at) === node.char && rest(at + 1);
    case "anyChar":
      return at < input.length && rest(at + 1);
    case "charClass": {
      if (at >= input.length) {
        return false;
      }
      const char = input.charAt(at);
      const held = node.ranges.some((range) => range.from <= char && char <= range.to);
      return held !== node.negated && rest(at + 1);
    }
    case "sequence":
      return matchItems(node.items, 0, input, at, rest);
    case "repeat":
      return matchRepeat(node, 0, input, at, rest);
  }
}

function matchItems(
  items: readonly Node[],
  index: number,
  input: string,
  at: number,
  rest: Rest,
): boolean {
  const item = items[index];

  if (item === undefined) {
    return rest(at);
  }

  return matchFrom(item, input, at, (next) => matchItems(items, index + 1, input, next, rest));
}

function matchRepeat(node: Repeat, taken: number, input: string, at: number, rest: Rest): boolean {
  const room = node.most === "many" || taken < node.most;
  const another = (next: number): boolean => matchRepeat(node, taken + 1, input, next, rest);

  if (room && matchFrom(node.item, input, at, another)) {
    return true;
  }

  return taken >= node.least && rest(at);
}
