import { matchTree } from "./match.js";
import { parse } from "./parse.js";

export type { AnyChar, Literal, Node, Sequence } from "./node.js";
export { parse, ParseError } from "./parse.js";

export function match(pattern: string, input: string): boolean {
  return matchTree(parse(pattern), input);
}
