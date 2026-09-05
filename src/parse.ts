import type { Node } from "./node.js";

export class ParseError extends Error {
  readonly index: number;

  constructor(message: string, index: number) {
    super(message);
    this.name = "ParseError";
    this.index = index;
  }
}

export function parse(pattern: string): Node {
  const items: Node[] = [];
  let at = 0;

  while (at < pattern.length) {
    const char = pattern.charAt(at);

    if (char === "\\") {
      const escaped = at + 1;
      if (escaped >= pattern.length) {
        throw new ParseError("a pattern cannot end on a backslash", at);
      }
      items.push({ kind: "literal", char: pattern.charAt(escaped) });
      at = escaped + 1;
      continue;
    }

    if (char === ".") {
      items.push({ kind: "anyChar" });
      at += 1;
      continue;
    }

    items.push({ kind: "literal", char });
    at += 1;
  }

  return { kind: "sequence", items };
}
