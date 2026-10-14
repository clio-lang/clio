import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import evidence from "../tests/fixtures/clio/port-probes/projects.json";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";

const snapshot = resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw new Error(
    "Usage: bun scripts/probe-clio-projects.ts /path/to/restored-clio-snapshot",
  );
for (const [path, hash] of Object.entries(evidence.sha256)) {
  assert.equal(
    createHash("sha256")
      .update(await readFile(join(snapshot, path)))
      .digest("hex"),
    hash,
    `Pinned source differs: ${path}`,
  );
}
const core = await import(
  pathToFileURL(join(snapshot, "packages/core/index.js")).href
);
const require = createRequire(join(snapshot, "package.json"));
const manifest = await import(
  pathToFileURL(require.resolve("clio-manifest")).href
);
const directory = await mkdtemp(join(tmpdir(), "kalandra-clio-projects-"));
const previous = process.cwd();
try {
  await cp(
    join(snapshot, "packages/core/tests"),
    join(directory, "packages/core/tests"),
    { recursive: true },
  );
  process.chdir(directory);
  const testDir = join(directory, "packages/core/tests");
  const source = await readFile(join(testDir, "clio.test.js"), "utf8");
  const tests: { name: string; run: () => void }[] = [];
  const context = {
    ...fs,
    ...manifest,
    ...core,
    dirname,
    join,
    __dirname: testDir,
    test: (name: string, run: () => void) => tests.push({ name, run }),
    expect: (value: unknown) => ({
      toEqual: (other: unknown) => assert.deepEqual(value, other),
      toBeLessThan: (other: bigint) => assert.ok((value as bigint) < other),
      toThrowError: (pattern: RegExp) => {
        let error: unknown;
        try {
          (value as () => void)();
        } catch (cause) {
          error = cause;
        }
        assert.ok(error, "Expected a missing-module error");
        // Only normalize the temporary project location in diagnostic candidate paths.
        const message = String(error).replace(
          /  - .*?packages\/core\/tests\//g,
          "  - packages/core/tests/",
        );
        assert.match(message, pattern);
      },
    }),
  };
  // Execute the original helpers and all three deferred declarations unchanged.
  runInNewContext(
    source.slice(
      source.indexOf("const compileProject ="),
      source.indexOf('testStr("Booleans"'),
    ) + source.slice(source.lastIndexOf("projectShouldThrow(")),
    context,
  );
  assert.deepEqual(
    tests.map((test) => test.name),
    evidence.deferred,
  );
  for (const test of tests) {
    test.run();
    console.log(`${test.name}: passed assertion (diagnostic paths normalized)`);
  }
  // New evidence probes: these are NOT original upstream fixtures.
  for (const [name, files] of Object.entries(evidence.cycles)) {
    const root = join(testDir, "clio/projects", name);
    fs.mkdirSync(join(root, "src"), { recursive: true });
    await cp(
      join(testDir, "clio/projects/cache/clio.toml"),
      join(root, "clio.toml"),
    );
    for (const [file, text] of Object.entries(files))
      await writeFile(join(root, "src", file), text);
    // VM timeout bounds synchronous recursive compilation without changing Clio.
    const helper = source.slice(
      source.indexOf("const compileProject ="),
      source.indexOf("const projectShouldThrow ="),
    );
    let outcome = "compiled";
    try {
      runInNewContext(
        `${helper}\ncompileProject(${JSON.stringify(name)})`,
        context,
        { timeout: 5000 },
      );
    } catch (error) {
      outcome = String(error);
    }
    assert.match(outcome, /Maximum call stack size exceeded/);
    console.log(`${name} cycle: ${outcome}`);
  }
} finally {
  process.chdir(previous);
  await rm(directory, { recursive: true, force: true });
}
