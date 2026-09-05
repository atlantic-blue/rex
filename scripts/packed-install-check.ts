#!/usr/bin/env -S node --experimental-strip-types

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PackReport {
  readonly filename: string;
  readonly files: readonly { readonly path: string }[];
}

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(repository, "package.json"), "utf8")) as {
  readonly name: string;
};

function run(command: string, args: readonly string[], cwd: string): string {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function requireThat(held: boolean, said: string): void {
  if (!held) {
    throw new Error(said);
  }
}

function pack(): { readonly tarball: string; readonly carried: readonly string[] } {
  const reports = JSON.parse(run("npm", ["pack", "--json"], repository)) as readonly PackReport[];
  const report = reports[0];

  if (report === undefined) {
    throw new Error("npm pack reported nothing");
  }

  return {
    tarball: join(repository, report.filename),
    carried: report.files.map((each) => each.path).sort(),
  };
}

function readTheTarball(carried: readonly string[]): void {
  console.log(`the tarball carries ${String(carried.length)} entries:`);
  for (const path of carried) {
    console.log(`  ${path}`);
  }

  requireThat(carried.includes("package.json"), "the tarball carries no package manifest");
  requireThat(carried.includes("dist/index.js"), "the tarball carries no built entry point");
  requireThat(carried.includes("dist/index.d.ts"), "the tarball carries no type declarations");

  // npm carries the readme and the licence into every tarball, whatever the files field says.
  const always = ["package.json", "README.md", "LICENSE", "LICENCE"];
  const strays = carried.filter(
    (path) => !always.includes(path) && !path.startsWith("dist/"),
  );
  requireThat(strays.length === 0, `the tarball carries what it must not: ${strays.join(", ")}`);

  const tests = carried.filter((path) => path.includes(".test."));
  requireThat(tests.length === 0, `the tarball carries a test file: ${tests.join(", ")}`);

  const sources = carried.filter((path) => path.startsWith("src/"));
  requireThat(sources.length === 0, `the tarball carries a source file: ${sources.join(", ")}`);

  const configuration = carried.filter((path) => path.startsWith("tsconfig"));
  requireThat(configuration.length === 0, `the tarball carries a configuration file: ${configuration.join(", ")}`);
}

const useFromJavaScript = `
import assert from "node:assert/strict";
import { ParseError, match, parse } from "${manifest.name}";

assert.equal(match("abc", "abc"), true);
assert.equal(match("a.c", "ac"), false);
assert.equal(match("^a[b-d]*c$", "abbdc"), true);
assert.equal(match("(ab)+", "abab"), true);
assert.equal(match("(ab)+", "ba"), false);

const tree = parse("a|b");
assert.equal(tree.kind, "alternate");

assert.throws(
  () => match("(a", "a"),
  (thrown) => thrown instanceof ParseError && thrown.index === 0,
);

console.log("the installed package answers from JavaScript");
`;

const useFromTypeScript = `
import { ParseError, match, parse } from "${manifest.name}";
import type { Alternate, Literal, Node } from "${manifest.name}";

function requireThat(answer: boolean, said: string): void {
  if (!answer) {
    throw new Error(said);
  }
}

const answer: boolean = match("a[b-d]*c", "abbdc");
requireThat(answer, "the built package did not match a[b-d]*c against abbdc");

const tree: Node = parse("a|b");
requireThat(tree.kind === "alternate", "parse did not answer an alternate tree");

const options: readonly Node[] = (tree as Alternate).options;
requireThat(options.length === 2, "the alternate tree did not carry two options");

const one: Literal = { kind: "literal", char: "a" };
requireThat(one.char === "a", "a literal node did not carry its character");

let index = -1;
try {
  match("[a", "a");
} catch (thrown) {
  index = (thrown as ParseError).index;
}
requireThat(index === 0, "an unclosed class did not report index 0");
`;

function installAndUse(tarball: string): void {
  const elsewhere = mkdtempSync(join(tmpdir(), "rex-packed-"));

  try {
    writeFileSync(
      join(elsewhere, "package.json"),
      `${JSON.stringify({ name: "rex-packed-check", private: true, type: "module", version: "0.0.0" }, null, 2)}\n`,
    );

    run("npm", ["install", "--no-audit", "--no-fund", tarball], elsewhere);

    writeFileSync(join(elsewhere, "use.js"), useFromJavaScript);
    console.log(run("node", ["use.js"], elsewhere).trim());

    writeFileSync(join(elsewhere, "use.ts"), useFromTypeScript);
    run(
      "node",
      [
        join(repository, "node_modules", "typescript", "bin", "tsc"),
        "--strict",
        "--target",
        "es2023",
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--noEmit",
        "use.ts",
      ],
      elsewhere,
    );
    console.log("the shipped type declarations typecheck");

    run("node", ["--experimental-strip-types", "use.ts"], elsewhere);
    console.log("the installed package answers from TypeScript");
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
}

const packed = pack();

try {
  readTheTarball(packed.carried);
  installAndUse(packed.tarball);
} finally {
  rmSync(packed.tarball, { force: true });
}

console.log("the packed package installs and answers");
