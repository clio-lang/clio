import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import evidence from "../tests/fixtures/clio/port-probes/cli.json";

if (!process.argv[2])
  throw new Error(
    "Usage: bun scripts/probe-clio-cli.ts /path/to/restored-clio-snapshot",
  );
const snapshot = path.resolve(process.argv[2]);
for (const [file, hash] of Object.entries(evidence.sha256)) {
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(path.join(snapshot, file)))
      .digest("hex"),
    hash,
    file,
  );
}
const load = (file: string) =>
  import(pathToFileURL(path.join(snapshot, file)).href);
const core = await load("packages/core/index.js");
const manifest = await load("packages/manifest/index.js");
const require = createRequire(path.join(snapshot, "package.json"));
const { default: chalk } = await import(
  pathToFileURL(require.resolve("chalk")).href
);
const directory = fs.mkdtempSync(path.join(tmpdir(), "kalandra-clio-cli-"));
const previous = process.cwd();
process.chdir(directory);
const messages: string[] = [];
const fail = (error: unknown) => {
  throw error;
};
// Import wiring only: bodies remain original. Terminal UI is replaced below;
// network installation and process launching are forbidden in this harness.
function evaluate(
  file: string,
  bindings: Record<string, unknown>,
  expression: string,
) {
  const source = fs
    .readFileSync(path.join(snapshot, file), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace(/^export default /gm, "const defaultExport = ")
    .replace(/^export (?=(?:const|function|async|class)\b)/gm, "");
  return runInNewContext(
    `${source}\n${expression}`,
    {
      ...fs,
      ...path,
      ...manifest,
      ...core,
      chalk,
      console: {
        log: (...args: unknown[]) => messages.push(args.join(" ")),
        error: fail,
      },
      error: fail,
      info() {},
      success() {},
      warn() {},
      ...bindings,
    },
    { timeout: 5000 },
  );
}
try {
  const configPath = path.join(directory, "clio.toml");
  fs.writeFileSync(configPath, evidence.manifest);
  fs.mkdirSync(path.join(directory, "src/assets"), { recursive: true });
  fs.writeFileSync(path.join(directory, "src/main.clio"), evidence.source);
  fs.writeFileSync(
    path.join(directory, "src/assets/message.txt"),
    "resource survives build\n",
  );
  const Progress = evaluate("packages/cli/lib/progress.js", {}, "Progress");
  const build = evaluate(
    "packages/cli/commands/build.js",
    {
      Progress,
      process: { env: {}, exit: fail },
      getPlatform: () => ({ build: async () => {} }),
      npmCommand: () => {
        throw new Error("Unexpected npm invocation");
      },
      fetchNpmDependencies: () => {
        throw new Error("Unexpected dependency installation");
      },
    },
    "build",
  );
  await build(configPath, {
    silent: true,
    skipNpmInstall: true,
    skipBundle: true,
  });
  assert.equal(
    fs.readFileSync(path.join(directory, "build/assets/message.txt"), "utf8"),
    "resource survives build\n",
  );
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(directory, "build/package.json"), "utf8"),
  );
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.dependencies["clio-run"], "latest");
  for (const file of [
    "main.clio.js",
    "main.clio.js.map",
    ".clio/index.js",
    ".clio/host.js",
    ".clio/rpc.json",
  ])
    assert.ok(fs.existsSync(path.join(directory, "build", file)), file);
  const decorators = await load("packages/internals/src/decorators.js");
  const factory = (
    await import(pathToFileURL(path.join(directory, "build/main.clio.js")).href)
  ).default;
  const exports = await factory({
    ...decorators,
    exports: {},
    register: (_id: string, fn: unknown) => fn,
  });
  assert.equal(exports.main(4), 8);
  console.log(
    "build: copied nested asset, emitted launch/config/package files; generated main(4) = 8",
  );

  chalk.level = 1;
  const { highlight } = await load("packages/highlight/index.js");
  const highlighted = highlight(path.join(directory, "src/main.clio"));
  assert.match(highlighted, /\u001b\[/);
  assert.equal(highlighted.replace(/\u001b\[[0-9;]*m/g, ""), evidence.source);
  chalk.level = 0;
  console.log(
    "highlight: ANSI output; source text preserved after removing ANSI codes",
  );

  // Drive the original docs navigation without a terminal. No function is called.
  const selections: string[][] = [];
  class AutoComplete {
    choices: string[];
    constructor(options: { choices: string[] }) {
      this.choices = options.choices;
      selections.push(this.choices);
    }
    clear() {}
    run() {
      return Promise.resolve(this.choices.find((choice) => choice !== ".."));
    }
  }
  class Toggle {
    clear() {}
    run() {
      return Promise.resolve(true);
    }
  }
  messages.length = 0;
  const docs = evaluate(
    "packages/cli/commands/docs.js",
    { AutoComplete, enquirer: { Toggle } },
    "docs",
  );
  await docs("src/main.clio", configPath);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(selections.some((choices) => choices.includes("main")));
  assert.ok(messages.some((message) => message.includes("Doubles a number")));
  console.log(
    "docs: original function selection and description rendering succeeded with scripted prompts",
  );

  fs.writeFileSync(
    configPath,
    evidence.manifest +
      '\n[dependencies]\n"github:example/library" = "v1.0.0"\n',
  );
  messages.length = 0;
  const show = evaluate(
    "packages/cli/commands/deps_commands/show.js",
    {},
    "handler",
  );
  await show({ project: directory });
  assert.deepEqual(messages, ["~> github:example/library: v1.0.0"]);
  console.log(
    "deps show: declared Git dependency displayed; no fetch performed",
  );

  fs.writeFileSync(
    path.join(directory, "kalandra.toml"),
    '[build]\nsource = "src"\n',
  );
  fs.writeFileSync(path.join(directory, "src/main.kalandra"), evidence.source);
  const modernBuild = Bun.spawnSync([
    process.execPath,
    path.join(previous, "packages/cli/src/index.ts"),
    "build",
    path.join(directory, "src/main.kalandra"),
    "-o",
    path.join(directory, "kalandra-build"),
    "--strict",
  ]);
  assert.equal(modernBuild.exitCode, 0, modernBuild.stderr.toString());
  console.log(
    `Kalandra asset copied: ${fs.existsSync(path.join(directory, "kalandra-build/assets/message.txt"))}`,
  );

  const alias = evaluate("packages/cli/commands/new.js", {}, "targetAlias");
  assert.equal(alias("javascript"), "js");
  assert.equal(alias("js"), undefined);
  console.log(
    "new: target aliases inspected; createPackage defaults undefined to js; no template clone attempted",
  );
} finally {
  process.chdir(previous);
  fs.rmSync(directory, { recursive: true, force: true });
}
