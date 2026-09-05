export interface Literal {
  readonly kind: "literal";
  readonly char: string;
}

export interface AnyChar {
  readonly kind: "anyChar";
}

export interface CharRange {
  readonly from: string;
  readonly to: string;
}

export interface CharClass {
  readonly kind: "charClass";
  readonly ranges: readonly CharRange[];
  readonly negated: boolean;
}

export interface Sequence {
  readonly kind: "sequence";
  readonly items: readonly Node[];
}

export interface Repeat {
  readonly kind: "repeat";
  readonly item: Node;
  readonly least: number;
  readonly most: number | "many";
}

export interface Alternate {
  readonly kind: "alternate";
  readonly options: readonly Node[];
}

export interface Group {
  readonly kind: "group";
  readonly item: Node;
}

export interface Anchor {
  readonly kind: "anchor";
  readonly at: "start" | "end";
}

export type Node =
  | Literal
  | AnyChar
  | CharClass
  | Sequence
  | Repeat
  | Alternate
  | Group
  | Anchor;
