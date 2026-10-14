import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import {
  compile,
  compileProject,
  type AnalysisOptions,
  type SemanticType,
} from "../packages/compiler/src/index.js";
import corpus from "./fixtures/clio/corpus.json";

async function temporary(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "kalandra-packages-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
async function execute(
  dir: string,
  text: string,
  options: AnalysisOptions = {},
) {
  const result = await compileProject(
    "main.kalandra",
    {
      async readSource(path) {
        return path === "main.kalandra" ? text : null;
      },
      async resolveExternal(dependency) {
        return pathToFileURL(
          join(
            dir,
            dependency.kind === "esm" ? "external.mjs" : "external.cjs",
          ),
        ).href;
      },
    },
    options,
  );
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.output).toBeDefined();
  for (const [path, file] of result.output!.files) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await Bun.write(join(dir, path), file.code);
  }
  return import(pathToFileURL(join(dir, result.output!.entry)).href);
}
const number: SemanticType = { kind: "Number" };
const callable: SemanticType = {
  kind: "Callable",
  parameters: [number],
  returns: number,
  async: false,
};

describe("saved JavaScript package imports", () => {
  const fixtures = corpus.accepted.filter(
    (f) =>
      /Import.*\((CJS|ESM|As|All as|All as alternate|Complex)\)$/.test(
        f.name,
      ) && /"(?:cjs|esm):test"/.test(f.source),
  );
  for (const fixture of fixtures)
    test(fixture.name, () =>
      temporary(async (dir) => {
        const esm = fixture.source.includes('"esm:');
        await Bun.write(
          join(dir, "external.mjs"),
          "export default function test(x) { return x*2 }; export const abc=3,a=1,b=2,c=4;",
        );
        await Bun.write(
          join(dir, "external.cjs"),
          "module.exports=Object.assign(x=>x*2,{abc:3,a:1,b:2,c:4});",
        );
        const names =
          fixture.name === "Import (Complex)"
            ? ["a", "b", "d", "t"]
            : fixture.name === "Import (As)" ||
                fixture.name.startsWith("Import (All as")
              ? ["b"]
              : fixture.name.startsWith("Import All As")
                ? ["foo"]
                : fixture.name.startsWith("Import As From")
                  ? ["xyz"]
                  : fixture.name.startsWith("Import From")
                    ? ["abc"]
                    : ["test"];
        const current = await execute(
          dir,
          fixture.source +
            "\n" +
            names.map((name) => `export ${name}`).join("\n"),
        );
        const target = pathToFileURL(
          join(dir, esm ? "external.mjs" : "external.cjs"),
        ).href;
        const legacy = fixture
          .expectedJavaScript!.replace(
            'from "test"',
            `from ${JSON.stringify(target)}`,
          )
          .replace(
            "return clio.exports",
            `clio.exports.observed=[${names.join(",")}];return clio.exports`,
          );
        const file = join(dir, "legacy.mjs");
        await Bun.write(file, legacy);
        const reference = await (
          await import(pathToFileURL(file).href)
        ).default({ exports: {} });
        expect(names.map((name) => current[name])).toEqual(reference.observed);
      }),
    );
});

test("ESM named bindings stay live; CommonJS destructuring remains a snapshot", () =>
  temporary(async (dir) => {
    await Bun.write(
      join(dir, "external.mjs"),
      "export let value=1; export function change(){value=2;} export default x=>x*2;",
    );
    await Bun.write(
      join(dir, "external.cjs"),
      "exports.value=1;exports.change=()=>{exports.value=2};",
    );
    const mod = await execute(
      dir,
      'from "esm:test" import value as esmValue change as esmChange * as ns\nfrom "cjs:test" import value as cjsValue change as cjsChange * as rest\nimport "esm:test" as double\nexport fn values: [esmValue cjsValue ns.value]\nexport fn change:\n  esmChange ()\n  cjsChange ()\nexport rest\nexport answer = double 21',
    );
    expect(mod.values()).toEqual([1, 1, 1]);
    mod.change();
    expect(mod.values()).toEqual([2, 1, 2]);
    expect(mod.answer).toBe(42);
    expect("value" in mod.rest).toBe(false);
  }));

test("supplied external signatures distinguish default, namespace, and CommonJS values", () => {
  const options: AnalysisOptions = {
    strictNames: true,
    modules: {
      "esm:test": { default: callable, value: number },
      "cjs:test": { value: number },
    },
    moduleValues: { "cjs:test": callable },
  };
  for (const text of [
    'import "esm:test"\ntest 2',
    'import "cjs:test"\ntest 2',
    'from "cjs:test" import * as fnx\nfnx 2',
    'from "esm:test" import value * as ns\nns.value + value',
  ]) {
    expect(
      compile({ path: "types.kalandra", text }, options).diagnostics.filter(
        (d) => d.severity === "error",
      ),
    ).toEqual([]);
  }
  for (const text of [
    'import "esm:test"\ntest "bad"',
    'import "cjs:test"\ntest "bad"',
    'from "esm:test" import missing',
  ])
    expect(
      compile({ path: "types.kalandra", text }, options).output,
    ).toBeUndefined();
  expect(
    compile(
      { path: "types.kalandra", text: 'import "esm:test"' },
      { modules: { "esm:test": { value: number } } },
    ).diagnostics.some((d) => d.message.includes("does not export default")),
  ).toBe(true);
});

test("project signature checking applies to external imports", async () => {
  const result = await compileProject(
    "main.kalandra",
    {
      async readSource() {
        return 'import "esm:test"\ntest "bad"';
      },
    },
    { modules: { "esm:test": { default: callable } } },
  );
  expect(result.output).toBeUndefined();
  expect(result.diagnostics.some((d) => d.code === "KAL3106")).toBe(true);
});

test("unresolved packages, unsafe specifiers, and nested imports remain diagnostics", async () => {
  for (const name of [
    "esm:",
    "esm:../file",
    "cjs:/tmp/file",
    "esm:https://example.com/module.js",
    "esm:@scope",
    "esm:pkg/../other",
  ]) {
    const result = await compileProject("main.kalandra", {
      async readSource() {
        return `import ${JSON.stringify(name)}`;
      },
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4103")).toBe(true);
  }
  for (const resolver of [
    async () => null,
    async () => {
      throw new Error("missing");
    },
  ]) {
    const result = await compileProject("main.kalandra", {
      async readSource() {
        return 'import "esm:missing"';
      },
      resolveExternal: resolver,
    });
    expect(result.output).toBeUndefined();
    expect(result.diagnostics.some((d) => d.code === "KAL4104")).toBe(true);
  }
  expect(
    compile({ path: "nested.kalandra", text: 'fn load:\n  import "esm:pkg"' })
      .output,
  ).toBeUndefined();
});

test("CLI resolves installed packages without executing them, even with a relocated output directory", () =>
  temporary(async (dir) => {
    const root = join(dir, "source space"),
      output = join(dir, "elsewhere"),
      packageDir = join(root, "node_modules", "@test", "interop");
    await mkdir(packageDir, { recursive: true });
    await Bun.write(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "@test/interop",
        type: "module",
        exports: { ".": "./entry.mjs", "./sub": "./sub.mjs" },
      }),
    );
    await Bun.write(
      join(packageDir, "entry.mjs"),
      'throw new Error("DEPENDENCY WAS EXECUTED"); export default 1;',
    );
    await Bun.write(join(packageDir, "sub.mjs"), "export const value=41;");
    const common = join(root, "node_modules", "test-common");
    await mkdir(common, { recursive: true });
    await Bun.write(
      join(common, "package.json"),
      JSON.stringify({ name: "test-common", main: "index.cjs" }),
    );
    await Bun.write(join(common, "index.cjs"), "module.exports=x=>x*2;");
    const entry = join(root, "main.kalandra");
    const run = () =>
      Bun.spawnSync([
        process.execPath,
        "packages/cli/src/index.ts",
        "build",
        entry,
        "-o",
        output,
      ]);
    await Bun.write(entry, 'import "esm:@test/interop"\nexport interop');
    const built = run();
    expect(built.exitCode).toBe(0);
    expect(built.stderr.toString()).not.toContain("DEPENDENCY WAS EXECUTED");
    // Build a second program to execute without touching the throwing package entry.
    await Bun.write(
      entry,
      'from "esm:@test/interop/sub" import value\nfrom "esm:node:path" import basename\nexport result = value + 1\nexport name = basename "/a/b"\nimport "cjs:test-common" as common\nexport doubled = common 21',
    );
    expect(run().exitCode).toBe(0);
    const mod = await import(
      pathToFileURL(join(output, "main.kalandra.mjs")).href
    );
    expect(mod.result).toBe(42);
    expect(mod.name).toBe("b");
    expect(mod.doubled).toBe(42);
    const before = await Bun.file(join(output, "main.kalandra.mjs")).text();
    await Bun.write(entry, 'import "cjs:not-installed-kalandra-test"');
    const missing = run();
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr.toString()).toContain("KAL4104");
    expect(await Bun.file(join(output, "main.kalandra.mjs")).text()).toBe(
      before,
    );
  }));
