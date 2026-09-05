import type { CharClass, CharRange, Group, Node, Repeat, Sequence } from "./node.js";

export class ParseError extends Error {
  readonly index: number;

  constructor(message: string, index: number) {
    super(message);
    this.name = "ParseError";
    this.index = index;
  }
}

const unclosedClass = "a character class needs a closing bracket";
const nothingToRepeat = "a quantifier needs an item before it";
const stackedQuantifier = "a quantifier cannot follow another quantifier";
const unclosedGroup = "a group needs a closing parenthesis";
const unopenedGroup = "a closing parenthesis has no group to close";

interface ReadChar {
  readonly char: string;
  readonly next: number;
}

interface Read<Shape extends Node> {
  readonly node: Shape;
  readonly next: number;
}

interface Bounds {
  readonly least: number;
  readonly most: number | "many";
}

const quantifiers = new Map<string, Bounds>([
  ["*", { least: 0, most: "many" }],
  ["+", { least: 1, most: "many" }],
  ["?", { least: 0, most: 1 }],
]);

const anchors = new Map<string, "start" | "end">([
  ["^", "start"],
  ["$", "end"],
]);

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

function readClass(pattern: string, open: number): Read<CharClass> {
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

function repeatLast(items: Node[], bounds: Bounds, at: number): Repeat {
  const item = items[items.length - 1];

  if (item === undefined) {
    throw new ParseError(nothingToRepeat, at);
  }

  if (item.kind === "repeat") {
    throw new ParseError(stackedQuantifier, at);
  }

  items.pop();
  return { kind: "repeat", item, least: bounds.least, most: bounds.most };
}

function readGroup(pattern: string, open: number): Read<Group> {
  const read = readAlternation(pattern, open + 1);

  if (pattern.charAt(read.next) !== ")") {
    throw new ParseError(unclosedGroup, open);
  }

  return { node: { kind: "group", item: read.node }, next: read.next + 1 };
}

function readSequence(pattern: string, from: number): Read<Sequence> {
  const items: Node[] = [];
  let at = from;

  while (at < pattern.length) {
    const char = pattern.charAt(at);

    if (char === "|" || char === ")") {
      break;
    }

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

    if (char === "(") {
      const read = readGroup(pattern, at);
      items.push(read.node);
      at = read.next;
      continue;
    }

    const bounds = quantifiers.get(char);
    if (bounds !== undefined) {
      items.push(repeatLast(items, bounds, at));
      at += 1;
      continue;
    }

    const anchor = anchors.get(char);
    if (anchor !== undefined) {
      items.push({ kind: "anchor", at: anchor });
      at += 1;
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

  return { node: { kind: "sequence", items }, next: at };
}

function readAlternation(pattern: string, from: number): Read<Node> {
  const options: Node[] = [];
  let at = from;

  for (;;) {
    const read = readSequence(pattern, at);
    options.push(read.node);
    at = read.next;

    if (pattern.charAt(at) !== "|") {
      break;
    }

    at += 1;
  }

  const only = options[0];

  if (options.length === 1 && only !== undefined) {
    return { node: only, next: at };
  }

  return { node: { kind: "alternate", options }, next: at };
}

export function parse(pattern: string): Node {
  const read = readAlternation(pattern, 0);

  if (read.next < pattern.length) {
    throw new ParseError(unopenedGroup, read.next);
  }

  return read.node;
}
