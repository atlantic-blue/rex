export interface Literal {
  readonly kind: "literal";
  readonly char: string;
}

export interface AnyChar {
  readonly kind: "anyChar";
}

export interface Sequence {
  readonly kind: "sequence";
  readonly items: readonly Node[];
}

export type Node = Literal | AnyChar | Sequence;
