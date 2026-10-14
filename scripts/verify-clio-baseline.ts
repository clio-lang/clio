import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import probe from "../tests/fixtures/clio/port-probes/decorated-tail.json";

// The caller supplies an isolated, dependency-restored archive of the documented commit.
const snapshot = process.argv[2];
if (!snapshot)
  throw new Error(
    "Usage: bun scripts/verify-clio-baseline.ts /path/to/restored-clio-snapshot",
  );
const load = (path: string) =>
  import(pathToFileURL(resolve(snapshot, path)).href);
const { compile } = await load("packages/core/index.js");
const decorators = await load("packages/internals/src/decorators.js");
const { Any } = await load("packages/internals/src/types.js");
const { emitter } = await load("packages/internals/src/emitter.js");
const directory = await mkdtemp(join(tmpdir(), "kalandra-clio-baseline-"));
try {
  const source = await readFile(
    "tests/fixtures/clio/port-probes/decorated-tail.clio",
    "utf8",
  );
  assert.equal(source, probe.source);
  const { code } = compile(source, probe.file, { rpcPrefix: "parity" });
  assert.equal(code, probe.code);
  await writeFile(join(directory, "tail.mjs"), code);
  const factory = (
    await import(pathToFileURL(join(directory, "tail.mjs")).href)
  ).default;
  // Registration is an identity adapter: these probes perform no RPC dispatch.
  const register = (_id: string, fn: unknown) => fn;
  const module = await factory({ ...decorators, Any, exports: {}, register });
  let calls = 0;
  const count = module.make(
    (fn: (...args: number[]) => number) =>
      (...args: number[]) => {
        calls++;
        return fn(...args);
      },
  );
  const results = {
    sum: module.sum(100000, 0),
    decorated: count(100000, 0),
    calls,
    asyncSum: await module.asyncSum(100000, 0, async (n: number) => n),
    doc: module.sum.__doc__,
  };
  assert.deepEqual(results, probe.results);
  const eventCode = compile("export fn make: emitter ()\n", "emitter.clio", {
    rpcPrefix: "parity",
  }).code;
  await writeFile(join(directory, "emitter.mjs"), eventCode);
  const events: number[] = [];
  const listener = (value: number) => events.push(value);
  const eventModule = await (
    await import(pathToFileURL(join(directory, "emitter.mjs")).href)
  ).default({ emitter, exports: {}, register });
  eventModule
    .make()
    .on("reading", listener)
    .emit("reading", 7)
    .off("reading", listener)
    .emit("reading", 9);
  assert.deepEqual(events, [7]);
  console.log(JSON.stringify({ commit: probe.commit, tail: results, events }));
} finally {
  await rm(directory, { recursive: true, force: true });
}
