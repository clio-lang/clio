import { expect, test } from "bun:test";

function run(...args: string[]) {
  return Bun.spawnSync([
    process.execPath,
    "packages/cli/src/index.ts",
    ...args,
  ]);
}

test("CLI explains the current foundation status", () => {
  const result = run("--help");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("--bindings endpoints.json");
});

test("CLI reports its development version", () => {
  const result = run("--version");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("0.13.0");
});

test("unsupported commands fail instead of pretending to compile", () => {
  const result = run("build");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("Unknown argument");
});

test("parse reads a file and emits the independent AST", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-cli-"));
  const path = join(directory, "sample.kalandra");
  try {
    await Bun.write(path, "fn double x: x * 2");
    const result = run("parse", path);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString()).body[0]).toMatchObject({
      kind: "FunctionDeclaration",
      name: "double",
    });
    await Bun.write(path, "fn :");
    const broken = run("parse", path);
    expect(broken.exitCode).toBe(1);
    expect(broken.stdout.toString()).toBe("");
    expect(broken.stderr.toString()).toContain(`${path}:1:4 KAL2001`);
    expect(run("parse", join(directory, "missing")).exitCode).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("check distinguishes known type errors, unresolved names, and strict mode", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-check-"));
  const path = join(directory, "sample.kalandra");
  try {
    await Bun.write(path, "Number n = 2\nn + 1");
    const good = run("check", path, "--strict");
    expect(good.exitCode).toBe(0);
    expect(good.stdout.toString()).toContain("no known errors");
    await Bun.write(path, 'Number n = "bad"');
    const bad = run("check", path);
    expect(bad.exitCode).toBe(1);
    expect(bad.stderr.toString()).toContain("KAL3111 (error)");
    expect(bad.stdout.toString()).toBe("");
    await Bun.write(path, "unknown 1");
    expect(run("check", path).exitCode).toBe(0);
    expect(run("check", path).stderr.toString()).toContain("KAL3001 (warning)");
    expect(run("check", path, "--strict").exitCode).toBe(1);
    await Bun.write(path, "fn :");
    expect(run("check", path).exitCode).toBe(1);
    expect(run("check", path, "--unsupported").exitCode).toBe(1);
    expect(run("check", join(directory, "missing")).exitCode).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("compile emits executable ESM and source maps without executing the source", async () => {
  const { mkdtemp, rm, symlink } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-compile-"));
  const path = join(directory, "source.kalandra"),
    output = join(directory, "out", "program space.mjs");
  try {
    const source = "export fn double x: x * 2";
    await Bun.write(path, source);
    const result = run("compile", path, "-o", output, "--strict");
    expect(result.exitCode).toBe(0);
    expect((await import(pathToFileURL(output).href)).double(21)).toBe(42);
    const map = await Bun.file(output + ".map").json();
    expect(map.sources).toEqual([path]);
    expect(map.sourcesContent).toEqual([source]);
    expect(await Bun.file(output).text()).toContain(
      "sourceMappingURL=program%20space.mjs.map",
    );
    const stdout = run("compile", path);
    expect(stdout.exitCode).toBe(0);
    expect(stdout.stdout.toString()).toContain(
      "sourceMappingURL=data:application/json",
    );
    expect(run("compile", path, "-o", path).exitCode).toBe(1);
    expect(await Bun.file(path).text()).toBe(source);
    const link = join(directory, "alias.mjs");
    await symlink(path, link);
    expect(run("compile", path, "-o", link).exitCode).toBe(1);
    await Bun.write(path, "1 in [1 2]");
    const before = await Bun.file(output).text();
    const rejected = run("compile", path, "-o", output);
    expect(rejected.exitCode).toBe(1);
    expect(rejected.stderr.toString()).toContain("KAL4001");
    expect(await Bun.file(output).text()).toBe(before);
    expect(run("compile", path, "-o").exitCode).toBe(1);
    await Bun.write(path, "thrower ()");
    expect(run("compile", path).exitCode).toBe(0);
    expect(run("compile", path, "--strict").exitCode).toBe(1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("project rebuilds restore deleted dependencies and pick up source changes", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-rebuild-"));
  const entry = join(directory, "src/main.kalandra");
  const dependency = join(directory, "src/foo.kalandra");
  const output = join(directory, "build");
  const emitted = join(output, "foo.kalandra.mjs");
  try {
    await Bun.write(
      join(directory, "kalandra.toml"),
      '[build]\nsource = "src"\n',
    );
    await Bun.write(entry, 'from "/foo" import bar\nexport fn main: bar\n');
    await Bun.write(dependency, 'export bar = "bar"\n');
    const build = () => {
      const result = run("build", entry, "-o", output, "--strict");
      expect(result.stderr.toString()).toBe("");
      expect(result.exitCode).toBe(0);
    };
    const evaluate = () => {
      // A fresh process avoids ESM caching masking rebuilt dependency contents.
      const result = Bun.spawnSync([
        process.execPath,
        "-e",
        `const m = await import(${JSON.stringify(pathToFileURL(join(output, "main.kalandra.mjs")).href)}); console.log(JSON.stringify(await m.main()));`,
      ]);
      expect(result.exitCode).toBe(0);
      return JSON.parse(result.stdout.toString());
    };
    build();
    const original = await Bun.file(emitted).text();
    expect(evaluate()).toBe("bar");
    build();
    expect(await Bun.file(emitted).text()).toBe(original);
    await rm(emitted);
    build();
    expect(await Bun.file(emitted).text()).toBe(original);
    expect(evaluate()).toBe("bar");
    await Bun.write(dependency, 'export bar = "updated"\n');
    build();
    expect(evaluate()).toBe("updated");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
