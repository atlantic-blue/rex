import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Case, Result, Settings } from "./bench.js";
import { cases, climb, measureApart, report, runCases } from "./bench.js";

const answersQuickly = `
export function match(pattern: string, input: string): boolean {
  return input.includes(pattern);
}
`;

const neverAnswers = `
export function match(): boolean {
  for (;;) {
    // A pattern that backtracks for ever answers nothing, and holds its thread.
  }
}
`;

const carriesNoMatch = `
export const nothing: boolean = true;
`;

const folder = mkdtempSync(join(tmpdir(), "rex-bench-"));

function fixture(name: string, source: string): string {
  const path = join(folder, name);
  writeFileSync(path, source);
  return pathToFileURL(path).href;
}

const quick = fixture("quick.mts", answersQuickly);
const endless = fixture("endless.mts", neverAnswers);
const empty = fixture("empty.mts", carriesNoMatch);

afterAll(() => {
  rmSync(folder, { recursive: true, force: true });
});

function settingsFor(rexUrl: string, budgetMillis: number): Settings {
  return { rexUrl, budgetMillis, leastMillis: 5, warmupIterations: 1, longest: 3 };
}

const matching: Case = { label: "a literal that matches", pattern: "ab", input: "cab" };
const missing: Case = { label: "a literal that does not match", pattern: "zz", input: "cab" };
const small: readonly Case[] = [matching, missing];

describe("a run that finishes", () => {
  let results: readonly Result[] = [];

  beforeAll(() => {
    results = runCases(small, settingsFor(quick, 20000));
  }, 60000);

  it("answers one result for each case", () => {
    expect(results).toHaveLength(small.length);
    expect(results.map((result) => result.subject.label)).toEqual(small.map((each) => each.label));
  });

  it("measures both engines for every case", () => {
    for (const result of results) {
      expect(result.rex.kind).toBe("measured");
      expect(result.regexp.kind).toBe("measured");
    }
  });

  it("counts the iterations that produced each figure", () => {
    for (const result of results) {
      if (result.rex.kind !== "measured") {
        throw new Error("rex gave no measurement");
      }
      expect(result.rex.measurement.iterations).toBeGreaterThanOrEqual(1);
      expect(result.rex.measurement.elapsedMillis).toBeGreaterThanOrEqual(5);
    }
  });

  it("reads the same answer from both engines", () => {
    for (const result of results) {
      if (result.rex.kind !== "measured" || result.regexp.kind !== "measured") {
        throw new Error("an engine gave no measurement");
      }
      expect(result.rex.measurement.answer).toBe(result.regexp.measurement.answer);
    }
  });
});

describe("a case that passes its budget", () => {
  it(
    "reads as a timeout, and carries the budget",
    () => {
      const outcome = measureApart(
        {
          engine: { kind: "rex", url: endless },
          pattern: "ab",
          input: "cab",
          warmupIterations: 0,
          leastMillis: 5,
        },
        500,
      );

      expect(outcome).toEqual({ kind: "timeout", budgetMillis: 500 });
    },
    30000,
  );

  it(
    "stops one engine and still measures the other",
    () => {
      const results = runCases([matching], settingsFor(endless, 500));

      expect(results).toHaveLength(1);
      expect(results.map((result) => result.rex.kind)).toEqual(["timeout"]);
      expect(results.map((result) => result.regexp.kind)).toEqual(["measured"]);
    },
    30000,
  );

  it(
    "says so in the report instead of dropping the case",
    () => {
      const settings = settingsFor(endless, 500);
      const written = report(runCases([matching], settings), [], settings, new Date(0)).join("\n");

      expect(written).toContain("no answer inside the budget of 500 ms");
      expect(written).toContain("no ratio, because one engine gave no figure");
    },
    30000,
  );
});

describe("the growing pathological case", () => {
  it(
    "stops the engine that passed the budget and climbs on with the other",
    () => {
      const rungs = climb(settingsFor(endless, 500));

      expect(rungs).toHaveLength(3);
      expect(rungs.map((rung) => rung.length)).toEqual([1, 2, 3]);
      expect(rungs[0]?.rex).toEqual({ kind: "timeout", budgetMillis: 500 });
      expect(rungs.slice(1).map((rung) => rung.rex)).toEqual(["not run", "not run"]);

      for (const rung of rungs) {
        expect(rung.regexp).toHaveProperty("kind", "measured");
      }
    },
    60000,
  );
});

describe("an engine that cannot be loaded", () => {
  it(
    "reads as a failure rather than throwing",
    () => {
      const outcome = measureApart(
        {
          engine: { kind: "rex", url: empty },
          pattern: "ab",
          input: "cab",
          warmupIterations: 0,
          leastMillis: 5,
        },
        20000,
      );

      expect(outcome.kind).toBe("failed");
    },
    30000,
  );
});

describe("the report", () => {
  const written = report([], [], settingsFor(quick, 500), new Date(0)).join("\n");

  it("names the engine it measured against", () => {
    expect(written).toContain("Node uses the V8 engine, and Chrome uses the V8 engine");
    expect(written).toContain("It does not measure Firefox");
    expect(written).toContain("It does not measure Safari");
  });

  it("carries the machine, the runtime and the date", () => {
    expect(written).toContain("1970-01-01T00:00:00.000Z");
    expect(written).toContain(`Node ${process.version}`);
    expect(written).toContain("platform   ");
    expect(written).toContain("processor  ");
  });
});

describe("the shapes this benchmark covers", () => {
  it("carries one case for each shape the engine supports", () => {
    expect(cases.map((each) => each.pattern)).toEqual([
      "abc",
      "abc",
      "a.c",
      "[a-z]+",
      "[^0-9]+",
      "a*a",
      "ab|cd",
      "(ab)+",
      "^abc$",
      "^[a-z]+@[a-z]+\\.[a-z]+$",
    ]);
  });
});
