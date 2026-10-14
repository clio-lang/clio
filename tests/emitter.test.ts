import { expect, test } from "bun:test";
import { AsyncResource } from "node:async_hooks";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile, compileProject } from "../packages/compiler/src/index.js";
import original from "./fixtures/clio/port-probes/emitter-runtime.json";

const old = new Function(
  "AsyncResource",
  original.random.replace("export default randomId;", "") +
    original.emitter.replace(/^import .*;$/gm, "").replaceAll("export ", "") +
    "\nreturn emitter;",
)(AsyncResource);
const result = compile(
  { path: "events.kalandra", text: "export fn make: emitter ()\n" },
  { strictNames: true },
);
expect(result.diagnostics).toEqual([]);
const directory = await mkdtemp(join(tmpdir(), "kalandra-events-"));
await Bun.write(join(directory, "events.mjs"), result.output!.code);
const current = (
  await import(pathToFileURL(join(directory, "events.mjs")).href)
).make;
await rm(directory, { recursive: true, force: true });

for (const [name, create] of [
  ["pinned Clio", old],
  ["Kalandra", current],
] as const) {
  test(`${name}: ordering, duplicate registration, removal, regex identity and exclusions`, () => {
    const bus = create(),
      events: unknown[] = [];
    const exact = (...args: unknown[]) => events.push(["exact", ...args]);
    const regex = (...args: unknown[]) => events.push(["regex", ...args]);
    expect(bus.id).toMatch(/^emitter\.[a-z0-9]{64}$/);
    expect(bus.on("item", exact)).toBe(bus);
    bus
      .on("item", exact)
      .on(/^item$/g, regex)
      .on(/^item$/g, regex);
    expect(bus.emit("item", 1, 2)).toBe(bus);
    expect(events).toEqual([
      ["exact", 1, 2],
      ["exact", 1, 2],
      ["regex", "item", 1, 2],
      ["regex", "item", 1, 2],
    ]);
    events.length = 0;
    expect(bus.emitUnless(exact, "item", 3)).toBe(bus);
    expect(events).toEqual([
      ["regex", "item", 3],
      ["regex", "item", 3],
    ]);
    events.length = 0;
    expect(bus.off(/^item$/g, regex)).toBe(bus);
    bus.off("item", exact).emit("item", 4);
    expect(events).toEqual([]);
    bus.on(/a\/b/i, regex).emit("A/b", 5);
    expect(events).toEqual([["regex", "A/b", 5]]);
    expect(create().emit("item", 1)).not.toBe(bus);
  });
  test(`${name}: listeners added during dispatch wait until the next emission`, async () => {
    const bus = create(),
      events: string[] = [];
    const late = () => events.push("late");
    bus.on("event", () => {
      events.push("first");
      bus.on("event", late);
    });
    bus.emit("event");
    expect(events).toEqual(["first"]);
    bus.emit("event");
    expect(events).toEqual(["first", "first", "late"]);
    let finished = false;
    bus.on("async", async () => {
      await Promise.resolve();
      finished = true;
    });
    expect(bus.emit("async")).toBe(bus);
    expect(finished).toBe(false);
    await Promise.resolve();
    expect(finished).toBe(true);
  });
  test(`${name}: listener mutation, synchronous reentrancy and failure propagation`, () => {
    const bus = create(),
      events: number[] = [];
    const second = () => events.push(2);
    bus
      .on("change", () => {
        events.push(1);
        bus.off("change", second);
      })
      .on("change", second);
    bus.emit("change").emit("change");
    expect(events).toEqual([1, 2, 1]);
    events.length = 0;
    bus.on("nested", (n: number) => {
      events.push(n);
      if (n) bus.emit("nested", n - 1);
    });
    bus.emit("nested", 2);
    expect(events).toEqual([2, 1, 0]);
    const failure = new Error("listener failed");
    bus
      .on("bad", () => {
        throw failure;
      })
      .on("bad", () => events.push(9));
    expect(() => bus.emit("bad")).toThrow(failure);
    expect(events).toEqual([2, 1, 0]);
    // Preserve old reserved-key failures instead of redesigning listener tables.
    expect(() => bus.on("__proto__", second)).toThrow(TypeError);
  });
}

test("live emitters remain rejected at parallel and remote boundaries", async () => {
  for (const text of [
    "fn make: emitter ()\nexport fn main: await |make| ()",
    "@params Any\nfn consume event: 1\nexport fn main: await |consume| (emitter ())",
  ]) {
    const result = await compileProject("main.kalandra", {
      readSource: async () => text,
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4202")).toBe(true);
  }
  const remote = await compileProject(
    "main.kalandra",
    { readSource: async () => "export fn make: emitter ()" },
    { remoteServices: { make: "make" } },
  );
  expect(remote.output).toBeUndefined();
  expect(remote.diagnostics.some((d) => d.code === "KAL4202")).toBe(true);
});

test("local events execute inside managed workers through the source CLI", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "packages/cli/src/index.ts",
      "run",
      "examples/local-events.kalandra",
      "--strict",
    ],
    { timeout: 15000 },
  );
  expect(result.exitCode).toBe(0);
  expect(result.stderr.toString()).toBe("");
  expect(JSON.parse(result.stdout.toString())).toEqual([6, 14]);
});
