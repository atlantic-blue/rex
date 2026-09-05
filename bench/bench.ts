#!/usr/bin/env -S node --experimental-strip-types

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import { fileURLToPath } from "node:url";

export type Engine =
  | { readonly kind: "regexp" }
  | { readonly kind: "rex"; readonly url: string };

export interface Work {
  readonly engine: Engine;
  readonly pattern: string;
  readonly input: string;
  readonly warmupIterations: number;
  readonly leastMillis: number;
}

export interface Measurement {
  readonly iterations: number;
  readonly elapsedMillis: number;
  readonly answer: boolean;
}

export type Outcome =
  | { readonly kind: "measured"; readonly measurement: Measurement }
  | { readonly kind: "timeout"; readonly budgetMillis: number }
  | { readonly kind: "failed"; readonly said: string };

export interface Case {
  readonly label: string;
  readonly pattern: string;
  readonly input: string;
}

export interface Result {
  readonly subject: Case;
  readonly rex: Outcome;
  readonly regexp: Outcome;
}

export interface Rung {
  readonly length: number;
  readonly rex: Outcome | "not run";
  readonly regexp: Outcome | "not run";
}

export interface Settings {
  readonly rexUrl: string;
  readonly budgetMillis: number;
  readonly leastMillis: number;
  readonly warmupIterations: number;
  readonly longest: number;
}

type Matcher = (pattern: string, input: string) => boolean;

const here = fileURLToPath(import.meta.url);

export const cases: readonly Case[] = [
  { label: "a plain literal", pattern: "abc", input: "abc" },
  { label: "a literal that fails late", pattern: "abc", input: "ab".repeat(500) },
  { label: "the dot", pattern: "a.c", input: "abc" },
  { label: "a character class", pattern: "[a-z]+", input: "thequickbrownfox" },
  { label: "a negated character class", pattern: "[^0-9]+", input: "thequickbrownfox" },
  { label: "a quantifier that backtracks", pattern: "a*a", input: "a".repeat(64) },
  { label: "alternation", pattern: "ab|cd", input: "cd" },
  { label: "a group with a quantifier", pattern: "(ab)+", input: "ab".repeat(16) },
  { label: "anchors", pattern: "^abc$", input: "abc" },
  {
    label: "a mixed pattern",
    pattern: "^[a-z]+@[a-z]+\\.[a-z]+$",
    input: "someone@example.com",
  },
];

export const pathological = "(a+)+b";

async function loadMatcher(engine: Engine): Promise<Matcher> {
  if (engine.kind === "regexp") {
    return (pattern: string, input: string): boolean => new RegExp(pattern).test(input);
  }

  const loaded = (await import(engine.url)) as unknown;

  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`the module at ${engine.url} answered nothing`);
  }

  const found: unknown = (loaded as Record<string, unknown>)["match"];

  if (typeof found !== "function") {
    throw new Error(`the module at ${engine.url} exports no match function`);
  }

  return found as Matcher;
}

/**
 * Runs the work in this process. The caller is responsible for the budget, because a
 * pattern that backtracks for ever cannot stop itself.
 */
export async function measureHere(work: Work): Promise<Measurement> {
  const matcher = await loadMatcher(work.engine);
  let answer = false;

  for (let taken = 0; taken < work.warmupIterations; taken += 1) {
    answer = matcher(work.pattern, work.input);
  }

  let iterations = 1;

  for (;;) {
    const started = performance.now();

    for (let taken = 0; taken < iterations; taken += 1) {
      answer = matcher(work.pattern, work.input);
    }

    const elapsedMillis = performance.now() - started;

    if (elapsedMillis >= work.leastMillis) {
      return { iterations, elapsedMillis, answer };
    }

    iterations *= 2;
  }
}

/**
 * Runs the work in a child process and kills it at the budget. A catastrophic pattern
 * holds the thread it runs on, so only a separate process can be stopped.
 */
export function measureApart(work: Work, budgetMillis: number): Outcome {
  const done = spawnSync(process.execPath, ["--experimental-strip-types", here, "--measure"], {
    input: JSON.stringify(work),
    timeout: budgetMillis,
    killSignal: "SIGKILL",
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });

  if (done.signal === "SIGKILL") {
    return { kind: "timeout", budgetMillis };
  }

  if (done.status !== 0) {
    const said = done.stderr.trim();
    return { kind: "failed", said: said === "" ? `the child exited with ${String(done.status)}` : said };
  }

  return { kind: "measured", measurement: JSON.parse(done.stdout) as Measurement };
}

export function runCases(subjects: readonly Case[], settings: Settings): readonly Result[] {
  return subjects.map((subject) => {
    const shared = {
      pattern: subject.pattern,
      input: subject.input,
      warmupIterations: settings.warmupIterations,
      leastMillis: settings.leastMillis,
    };

    return {
      subject,
      rex: measureApart({ engine: { kind: "rex", url: settings.rexUrl }, ...shared }, settings.budgetMillis),
      regexp: measureApart({ engine: { kind: "regexp" }, ...shared }, settings.budgetMillis),
    };
  });
}

/**
 * Grows the input by one letter at a time until each engine passes the budget. The two
 * engines stop independently, because one may give up long before the other.
 */
export function climb(settings: Settings): readonly Rung[] {
  const rungs: Rung[] = [];
  let rexClimbs = true;
  let regexpClimbs = true;

  for (let length = 1; length <= settings.longest && (rexClimbs || regexpClimbs); length += 1) {
    const shared = {
      pattern: pathological,
      input: "a".repeat(length),
      warmupIterations: 0,
      leastMillis: 0,
    };

    const rex: Outcome | "not run" = rexClimbs
      ? measureApart({ engine: { kind: "rex", url: settings.rexUrl }, ...shared }, settings.budgetMillis)
      : "not run";
    const regexp: Outcome | "not run" = regexpClimbs
      ? measureApart({ engine: { kind: "regexp" }, ...shared }, settings.budgetMillis)
      : "not run";

    rexClimbs = rex !== "not run" && rex.kind === "measured";
    regexpClimbs = regexp !== "not run" && regexp.kind === "measured";
    rungs.push({ length, rex, regexp });
  }

  return rungs;
}

function grouped(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function rate(measurement: Measurement): number {
  return (measurement.iterations / measurement.elapsedMillis) * 1000;
}

function shown(text: string): string {
  const cut = text.length > 28 ? `${text.slice(0, 28)}...` : text;
  return `"${cut}" (${String(text.length)} characters)`;
}

function say(name: string, outcome: Outcome): string {
  if (outcome.kind === "timeout") {
    return `${name} no answer inside the budget of ${String(outcome.budgetMillis)} ms`;
  }

  if (outcome.kind === "failed") {
    return `${name} failed: ${outcome.said}`;
  }

  const measurement = outcome.measurement;
  return [
    `${name} ${grouped(rate(measurement))} op/s`,
    `${String(measurement.iterations)} iterations in ${measurement.elapsedMillis.toFixed(3)} ms`,
  ].join("   ");
}

function compare(result: Result): string {
  if (result.rex.kind !== "measured" || result.regexp.kind !== "measured") {
    return "ratio    no ratio, because one engine gave no figure";
  }

  const rexRate = rate(result.rex.measurement);
  const regexpRate = rate(result.regexp.measurement);
  const agreement =
    result.rex.measurement.answer === result.regexp.measurement.answer
      ? `both engines answer ${String(result.rex.measurement.answer)}`
      : `THE ENGINES DISAGREE: rex answers ${String(result.rex.measurement.answer)} and RegExp answers ${String(result.regexp.measurement.answer)}`;
  const faster =
    regexpRate >= rexRate
      ? `RegExp is ${grouped(regexpRate / rexRate)} times faster`
      : `rex is ${grouped(rexRate / regexpRate)} times faster`;

  return `ratio    ${faster}; ${agreement}`;
}

function sayRung(name: string, outcome: Outcome | "not run"): string {
  if (outcome === "not run") {
    return `${name} not run`;
  }

  if (outcome.kind === "timeout") {
    return `${name} no answer inside ${String(outcome.budgetMillis)} ms`;
  }

  if (outcome.kind === "failed") {
    return `${name} failed: ${outcome.said}`;
  }

  return `${name} ${outcome.measurement.elapsedMillis.toFixed(3)} ms`;
}

function furthest(rungs: readonly Rung[], read: (rung: Rung) => Outcome | "not run", name: string): string {
  const answered = rungs.filter((rung) => {
    const outcome = read(rung);
    return outcome !== "not run" && outcome.kind === "measured";
  });
  const last = answered[answered.length - 1];

  if (last === undefined) {
    return `  ${name} answered at no length inside the budget.`;
  }

  const outcome = read(last);
  const took =
    outcome !== "not run" && outcome.kind === "measured"
      ? outcome.measurement.elapsedMillis.toFixed(3)
      : "unknown";
  const beyond = rungs.find((rung) => rung.length === last.length + 1);
  const next = beyond === undefined ? undefined : read(beyond);
  const ending =
    next !== undefined && next !== "not run" && next.kind === "timeout"
      ? `, and it passed the budget at length ${String(last.length + 1)}`
      : ", which is the longest length this run tried";

  return `  ${name} answered at length ${String(last.length)} in ${took} ms${ending}.`;
}

export function machine(settings: Settings, at: Date): readonly string[] {
  const processor = cpus()[0];

  return [
    `date       ${at.toISOString()}`,
    `runtime    Node ${process.version}, V8 ${process.versions.v8}`,
    `platform   ${platform()} ${arch()}`,
    `processor  ${processor === undefined ? "unknown" : processor.model}`,
    `processors ${String(cpus().length)} reported by the runtime`,
    `engine     ${settings.rexUrl}`,
    `budget     ${String(settings.budgetMillis)} ms for each measurement`,
    `batch      each timed batch runs for at least ${String(settings.leastMillis)} ms`,
    `warmup     ${String(settings.warmupIterations)}, the number of untimed calls before each timed batch`,
  ];
}

export function report(
  results: readonly Result[],
  rungs: readonly Rung[],
  settings: Settings,
  at: Date,
): readonly string[] {
  const lines: string[] = [
    "rex against the regular expressions the runtime already has",
    "",
    "This measures rex against the JavaScript RegExp that the runtime supplies.",
    "Node uses the V8 engine, and Chrome uses the V8 engine. This run therefore",
    "measures the same engine that Chrome uses.",
    "It does not measure Firefox. It does not measure Safari. Those two browsers",
    "use different engines.",
    "",
    "One operation is one call that takes the pattern as a string and answers true",
    "or false. Both engines pay to read the pattern on every call.",
    "",
    ...machine(settings, at),
    "",
    "Each shape",
    "",
  ];

  results.forEach((result, index) => {
    lines.push(
      `${String(index + 1).padStart(2, " ")}. ${result.subject.label}`,
      `    pattern  ${result.subject.pattern}`,
      `    input    ${shown(result.subject.input)}`,
      `    ${say("rex     ", result.rex)}`,
      `    ${say("RegExp  ", result.regexp)}`,
      `    ${compare(result)}`,
      "",
    );
  });

  lines.push(
    "The pathological case",
    "",
    `The pattern is ${pathological} against a run of the letter a with no b at the end.`,
    "Both engines backtrack, so both can take exponential time. The length grows by",
    "one letter until each engine passes the budget. The two engines stop separately.",
    "An engine that passed the budget reads not run at every longer length.",
    "",
  );

  for (const rung of rungs) {
    lines.push(
      `  length ${String(rung.length).padStart(2, " ")}   ${sayRung("rex", rung.rex).padEnd(32, " ")}${sayRung("RegExp", rung.regexp)}`,
    );
  }

  lines.push(
    "",
    furthest(rungs, (rung) => rung.rex, "rex   "),
    furthest(rungs, (rung) => rung.regexp, "RegExp"),
    "",
  );

  return lines;
}

function reading(name: string, fallback: number): number {
  const flag = `--${name}=`;
  const given = process.argv.find((argument) => argument.startsWith(flag));

  if (given === undefined) {
    return fallback;
  }

  const read = Number(given.slice(flag.length));

  if (!Number.isFinite(read) || read < 0) {
    throw new Error(`${flag} needs a number, and it read ${given.slice(flag.length)}`);
  }

  return read;
}

export function settingsFromArguments(): Settings {
  return {
    rexUrl: new URL("../dist/index.js", import.meta.url).href,
    budgetMillis: reading("budget", 5000),
    leastMillis: reading("batch", 250),
    warmupIterations: reading("warmup", 200),
    longest: reading("longest", 40),
  };
}

async function main(): Promise<void> {
  if (process.argv[2] === "--measure") {
    const work = JSON.parse(readFileSync(0, "utf8")) as Work;
    process.stdout.write(JSON.stringify(await measureHere(work)));
    return;
  }

  const settings = settingsFromArguments();
  const results = runCases(cases, settings);
  const rungs = climb(settings);

  for (const line of report(results, rungs, settings, new Date())) {
    console.log(line);
  }
}

if (process.argv[1] === here) {
  await main();
}
