import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ParseError, match, parse } from "./index.js";

describe("the public surface", () => {
  it("exports match as a function", () => {
    expect(typeof match).toBe("function");
  });

  it("exports parse as a function", () => {
    expect(typeof parse).toBe("function");
  });

  it("exports ParseError", () => {
    expect(new ParseError("bad", 0)).toBeInstanceOf(Error);
  });

  it("no longer refuses to answer", () => {
    expect(() => match("a", "a")).not.toThrow();
  });
});

describe("match", () => {
  it("matches a pattern of literals against the same string", () => {
    expect(match("abc", "abc")).toBe(true);
  });

  it("lets a dot stand for one character", () => {
    expect(match("a.c", "abc")).toBe(true);
  });

  it("does not let a dot stand for no character", () => {
    expect(match("a.c", "ac")).toBe(false);
  });

  it("reads an escaped dot as a literal dot", () => {
    expect(match("a\\.c", "a.c")).toBe(true);
    expect(match("a\\.c", "abc")).toBe(false);
  });

  it("finds the pattern anywhere in the input", () => {
    expect(match("bc", "abcd")).toBe(true);
  });

  it("matches an empty pattern against any input", () => {
    expect(match("", "abc")).toBe(true);
    expect(match("", "")).toBe(true);
  });

  it("answers false when the input is shorter than the pattern", () => {
    expect(match("abc", "ab")).toBe(false);
  });
});

describe("a pattern that ends on a backslash", () => {
  it("throws a ParseError with the index at the backslash", () => {
    expect.assertions(2);
    try {
      match("abc\\", "abc");
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(ParseError);
      expect((thrown as ParseError).index).toBe(3);
    }
  });
});

describe("the entry point", () => {
  const exportsOf = (name: string): readonly string[] => {
    const file = fileURLToPath(new URL(name, import.meta.url));
    const program = ts.createProgram([file], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2023,
      noEmit: true,
    });

    const source = program.getSourceFile(file);
    if (source === undefined) {
      throw new Error(`${name} did not compile`);
    }

    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(source);
    if (symbol === undefined) {
      throw new Error(`${name} exports nothing`);
    }

    return checker.getExportsOfModule(symbol).map((each) => each.getName());
  };

  it("re-exports every type that the node module exports", () => {
    const fromNode = exportsOf("./node.ts");
    const fromIndex = new Set(exportsOf("./index.ts"));

    expect(fromNode.length).toBeGreaterThan(0);
    expect(fromNode.filter((name) => !fromIndex.has(name))).toEqual([]);
  });
});
