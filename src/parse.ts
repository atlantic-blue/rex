import type { CharClass, CharRange, Node } from "./node.js";

export class ParseError extends Error {
  readonly index: number;

  constructor(message: string, index: number) {
    super(message);
    this.name = "ParseError";
    this.index = index;
  }
}

const unclosedClass = "a character class needs a closing bracket";

interface ReadChar {
  readonly char: string;
  readonly next: number;
}

interface ReadClass {
  readonly node: CharClass;
  readonly next: number;
}

function readClassChar(pattern: string, at: number, open: number): ReadChar {
  if (pattern.charAt(at) === "\\") {
    const escaped = at + 1;
    if (escaped >= pattern.length) {
      throw new ParseError(unclosedClass, open);
    }
    return { char: pattern.charAt(escaped), next: escaped + 1 };
  }
  return { char: pattern.charAt(at), next: at + 1 };
}

function readClass(pattern: string, open: number): ReadClass {
  let at = open + 1;
  let negated = false;

  if (pattern.charAt(at) === "^") {
    negated = true;
    at += 1;
  }

  const ranges: CharRange[] = [];

  while (at < pattern.length) {
    if (pattern.charAt(at) === "]") {
      return { node: { kind: "charClass", ranges, negated }, next: at + 1 };
    }

    const first = readClassChar(pattern, at, open);
    at = first.next;

    const dashLeads = pattern.charAt(at) === "-";
    const afterDash = at + 1;
    const dashEnds = afterDash >= pattern.length || pattern.charAt(afterDash) === "]";

    if (dashLeads && !dashEnds) {
      const second = readClassChar(pattern, afterDash, open);
      ranges.push({ from: first.char, to: second.char });
      at = second.next;
      continue;
    }

    ranges.push({ from: first.char, to: first.char });
  }

  throw new ParseError(unclosedClass, open);
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

    if (char === "[") {
      const read = readClass(pattern, at);
      items.push(read.node);
      at = read.next;
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
