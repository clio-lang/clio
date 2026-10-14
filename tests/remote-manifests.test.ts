import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, realpath, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  compileProject,
  type ProjectResult,
} from "../packages/compiler/src/index.js";
import { parseRemoteClientManifest } from "../packages/protocol/src/remote-contract.js";
import {
  loadRemoteClient,
  loadRemoteDeployment,
} from "../packages/runtime/hosts/bun/remote.js";

const numeric = "@params Number\n@returns Number\nexport fn double n: n * 2";
const build = (
  sources: Record<string, string>,
  remoteServices: Record<string, string> = { double: "double" },
) =>
  compileProject(
    "main.kalandra",
    { readSource: async (path) => sources[path] ?? null },
    { strictNames: true, remoteServices },
  );
function artifacts(result: ProjectResult) {
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const output = result.output!;
  expect(output.remote).toBeDefined();
  return {
    client: parseRemoteClientManifest(
      output.files.get(output.remote!.client)!.code,
    ),
    deployment: JSON.parse(output.files.get(output.remote!.deployment)!.code),
    output,
  };
}

test("explicit exported services generate tasks without any parallel call or application evaluation", async () => {
  const { client, deployment, output } = artifacts(
    await build({
      "main.kalandra": numeric + "\n1.missing ()\nexport fn privateUnused x: x",
    }),
  );
  expect(Object.keys(client.services)).toEqual(["double"]);
  expect(client.services.double!.signature).toEqual({
    args: ["number"],
    result: "number",
  });
  expect(client.services.double!.async).toBe(false);
  expect(client.services.double!.source).toEqual({
    module: "main.kalandra",
    exportName: "double",
  });
  expect(deployment.revision).toBe(client.revision);
  expect(client.revision).toMatch(/^[a-f0-9]{64}$/);
  expect(output.files.has(client.services.double!.module)).toBe(true);
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), "kalandra-service-")),
  );
  try {
    for (const [path, file] of output.files) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await Bun.write(join(directory, path), file.code);
    }
    // Loading companions must not evaluate the main module's throwing side effect.
    const loaded = await loadRemoteDeployment(
      join(directory, output.remote!.deployment),
    );
    const service = loaded.services.get("double")!;
    const module = await import(service.module);
    expect(module[service.exportName](1.5)).toBe(3);
    const routes = await loadRemoteClient(
      join(directory, output.remote!.client),
    );
    expect(routes.routes.get(service.module + "#" + service.exportName)).toBe(
      "double",
    );
    // Client route loading never evaluates even the task companion.
    await Bun.write(
      join(directory, client.services.double!.module),
      'throw new Error("do not import client code")',
    );
    expect(
      (await loadRemoteClient(join(directory, output.remote!.client))).routes
        .size,
    ).toBe(1);
    const outside = join(directory, "outside.mjs");
    await Bun.write(outside, "");
    await mkdir(join(directory, "nested"));
    const copied = {
      ...client,
      services: {
        double: { ...client.services.double!, module: "escape.mjs" },
      },
    };
    await Bun.write(
      join(directory, "nested/client.json"),
      JSON.stringify(copied),
    );
    await symlink(outside, join(directory, "nested/escape.mjs"));
    await expect(
      loadRemoteClient(join(directory, "nested/client.json")),
    ).rejects.toThrow("escapes");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("re-export aliases preserve public names and point at the defining task companion", async () => {
  const { client } = artifacts(
    await build(
      {
        "main.kalandra":
          'from "./deep/math" import double as twice\nexport twice',
        "deep/math.kalandra": numeric,
      },
      { calculate: "twice" },
    ),
  );
  expect(client.services.calculate!.source.exportName).toBe("twice");
  expect(client.services.calculate!.module).toBe(
    "deep/math.kalandra.mjs.tasks.mjs",
  );
});

test("revisions are deterministic and cover implementation, helpers, and service selection", async () => {
  const sources = {
    "main.kalandra": numeric + "\n@returns Number\nexport fn value: 3",
  };
  const first = artifacts(
    await build(sources, { double: "double", value: "value" }),
  );
  const reordered = artifacts(
    await build(sources, { value: "value", double: "double" }),
  );
  expect(reordered.client).toEqual(first.client);
  expect(reordered.output.files).toEqual(first.output.files);
  expect(artifacts(await build(sources)).client.revision).not.toBe(
    first.client.revision,
  );
  expect(
    artifacts(await build(sources, { renamed: "double", value: "value" }))
      .client.revision,
  ).not.toBe(first.client.revision);
  expect(
    artifacts(
      await build(
        { "main.kalandra": sources["main.kalandra"].replace("n * 2", "n * 3") },
        { double: "double", value: "value" },
      ),
    ).client.revision,
  ).not.toBe(first.client.revision);
  const graph = {
    "main.kalandra":
      'from "./helper" import helper\n@params Number\nexport fn double n: helper n',
    "helper.kalandra": "@params Number\nexport fn helper n: n * 2",
  };
  expect(
    artifacts(
      await build({
        ...graph,
        "helper.kalandra": graph["helper.kalandra"].replace("* 2", "* 3"),
      }),
    ).client.revision,
  ).not.toBe(artifacts(await build(graph)).client.revision);
});

test("ordinary builds expose no services and do not require serializable unused exports", async () => {
  const result = await compileProject("main.kalandra", {
    readSource: async () => "export fn dynamic x: x",
  });
  expect(result.output).toBeDefined();
  expect(result.output!.remote).toBeUndefined();
  expect(
    [...result.output!.files.keys()].some((path) => path.endsWith(".json")),
  ).toBe(false);
});

test("invalid service selections and unsafe signatures fail atomically", async () => {
  for (const [source, services] of [
    [numeric, {}],
    [numeric, { missing: "absent" }],
    [numeric, { "bad/id": "double" }],
    [numeric, { one: "double", two: "double" }],
    ["export double = 2", { double: "double" }],
    ["export fn double n: n", { double: "double" }],
    [
      "@params Number\n@returns Number\nexport fn double n: n.value",
      { double: "double" },
    ],
    [
      "Number offset = console.read ()\n@params Number\nexport fn double n: n + offset",
      { double: "double" },
    ],
    [
      "fn wrap f: f\n@wrap\n@params Number\n@returns Number\nexport fn double n: n * 2",
      { double: "double" },
    ],
  ] as const) {
    const result = await build({ "main.kalandra": source }, services);
    expect(result.output, source + JSON.stringify(services)).toBeUndefined();
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  }
  const transitive = await build({
    "main.kalandra":
      'from "./helper" import helper\n@params Number\nexport fn double n: helper n',
    "helper.kalandra":
      "Number offset = console.read ()\n@params Number\nexport fn helper n: n + offset",
  });
  expect(transitive.output).toBeUndefined();
  expect(transitive.diagnostics.some((d) => d.severity === "error")).toBe(true);
});

test("client contracts reject malformed schemas, routes and versions", async () => {
  const { client } = artifacts(await build({ "main.kalandra": numeric }));
  for (const mutate of [
    (value: any) => {
      value.version = 2;
    },
    (value: any) => {
      value.revision = "";
    },
    (value: any) => {
      value.services.double.signature.args = ["any"];
    },
    (value: any) => {
      value.services.double.signature.result = "string";
    },
    (value: any) => {
      value.services.double.module = "../escape.mjs";
    },
    (value: any) => {
      value.services.double.module = "file:///escape.mjs";
    },
    (value: any) => {
      value.services.double.module = "a%2fb.mjs";
    },
    (value: any) => {
      value.services.second = value.services.double;
    },
    (value: any) => {
      value.services.double.schemas = ['{"result":"number","args":["number"]}'];
    },
  ]) {
    const copy = structuredClone(client);
    mutate(copy);
    expect(() => parseRemoteClientManifest(JSON.stringify(copy))).toThrow();
  }
  expect(() => parseRemoteClientManifest(" ".repeat(1024 * 1024 + 1))).toThrow(
    "too large",
  );
});

test("declared signatures preserve arrays, record identities and async results", async () => {
  const { client } = artifacts(
    await build(
      {
        "main.kalandra": `type Point:\n  Number x\n@params Point\n@returns Point\nexport fn echo p: p\nlist Numbers: Number\n@params Numbers\n@returns Numbers\nexport fn values ns: ns\n@params Number\n@returns Number\nfn double n: n * 2\n@params Number\n@returns Number\nexport fn asyncDouble n: await |double| n`,
      },
      { echo: "echo", values: "values", asyncDouble: "asyncDouble" },
    ),
  );
  expect(client.services.echo!.signature.args[0]).toMatchObject({
    record: { fields: [["x", "number"]] },
  });
  expect(client.services.echo!.signature.result).toEqual(
    client.services.echo!.signature.args[0]!,
  );
  expect(client.services.values!.signature).toEqual({
    args: [{ array: "number" }],
    result: { array: "number" },
  });
  expect(client.services.asyncDouble!.async).toBe(true);
  expect(client.services.asyncDouble!.signature).toEqual({
    args: ["number"],
    result: "number",
  });
});

test("CLI emits selected service artifacts and preserves previous output on rejected builds", async () => {
  const { verifyRemoteBuildCli } =
    await import("./helpers/remote-build-cli.js");
  const directory = await mkdtemp(join(tmpdir(), "kalandra-remote-cli-"));
  try {
    await verifyRemoteBuildCli("packages/cli/src/index.ts", directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
