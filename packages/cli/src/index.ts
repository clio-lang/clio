#!/usr/bin/env bun
import { basename, dirname, resolve } from "node:path";
import { mkdir, realpath } from "node:fs/promises";

const args = Bun.argv.slice(2);
const command = args[0];
function options() {
  let watch = false;
  let bindings: string | undefined;
  const remoteServices: Record<string, string> = Object.create(null);
  let strict = false,
    output: string | undefined;
  for (let index = 2; index < args.length; index++) {
    if (command === "run" && args[index] === "--")
      return {
        strict,
        bindings,
        output,
        watch,
        programArgs: args.slice(index + 1),
        remoteServices: undefined,
      };
    if (
      args[index] === "--bindings" &&
      command === "run" &&
      bindings === undefined &&
      args[index + 1] &&
      !args[index + 1]!.startsWith("-")
    )
      bindings = args[++index]!;
    else if (args[index] === "--strict" && command !== "parse" && !strict)
      strict = true;
    else if (args[index] === "--watch" && command === "build" && !watch)
      watch = true;
    else if (
      args[index] === "--service" &&
      command === "build" &&
      args[index + 1]
    ) {
      const selection = args[++index]!;
      const equal = selection.indexOf("=");
      if (equal < 1 || equal === selection.length - 1) return;
      const id = selection.slice(0, equal);
      if (Object.hasOwn(remoteServices, id)) return;
      remoteServices[id] = selection.slice(equal + 1);
    } else if (
      args[index] === "-o" &&
      (command === "compile" || command === "build") &&
      output === undefined &&
      args[index + 1] &&
      !args[index + 1]!.startsWith("-")
    )
      output = args[++index]!;
    else return;
  }
  if (watch && Object.keys(remoteServices).length) return;
  return {
    strict,
    bindings,
    output,
    watch,
    programArgs: [] as string[],
    remoteServices: Object.keys(remoteServices).length
      ? remoteServices
      : undefined,
  };
}
const flags = options();
if (args.length === 1 && (command === "--version" || command === "-v")) {
  console.log("kalandra 0.13.0 (development)");
} else if (
  args.length === 0 ||
  (args.length === 1 && (command === "--help" || command === "-h"))
) {
  console.log(`Kalandra — development workspace

Usage: bun run cli [--help | --version]
       bun run cli new <directory>
       bun run cli install [directory]
       bun run cli highlight <file.kalandra> [--color auto|always|never]
       bun run cli docs <file.kalandra> [function] [--json]
       bun run cli fmt <file> [--check | --write]
       bun run cli parse <file>
       bun run cli check <file> [--strict]
       bun run cli compile <file> [-o output.mjs] [--strict]
       bun run cli build <entry.kalandra> -o <directory> [--strict] [--watch | --service id=export ...]
       bun run cli run <entry.kalandra> [--strict] [--bindings endpoints.json] [-- arguments...]
       bun run cli serve <kalandra.deployment.json> [--port N] [--token-env NAME] [--bindings endpoints.json]
         [--task-timeout-ms N] [--body-timeout-ms N] [--max-concurrent N]

new creates an offline starter in a new directory whose parent already exists.
It does not overwrite, install dependencies, or initialize Git.
install reads Git dependencies from the nearest kalandra.toml and pins commits in kalandra.lock.
highlight colors lexer tokens, using plain text when piped; --color always forces ANSI output.
docs lists top-level function declarations and literal @describe text without loading imports or executing source.
fmt prints formatted source; --check checks style without writing, --write updates the file.
parse prints the syntax tree as JSON.
check resolves names and checks known types in one file.
compile emits native ESM for the supported subset. Without -o, JavaScript and
an inline source map go to stdout; -o writes JavaScript and a .map sidecar.
build compiles imports and their export signatures as a project.
Manifest projects also copy ordinary build.source assets, preserving relative paths.
Hidden entries, node_modules, .kalandra files, manifests/locks and output are excluded.
Resource/output symlinks and destination collisions are rejected. Watch tracks assets;
removed assets are cleaned up only when their output still matches the copied bytes.
--service id=export explicitly exposes an entry export and emits kalandra.deployment.json
and kalandra.client.json. Repeat for multiple services; not available with --watch yet.
--watch rebuilds changed inputs; it never runs the generated program.
The nearest enclosing kalandra.toml supplies build.source; without one, the source
root is the entry file’s directory. -o remains explicit. esm:/cjs: packages resolve without execution.
Cycles are deferred. remote:./contract.json imports use local client contracts and emit
kalandra.remotes.json; remote execution requires host endpoint bindings.
--strict treats unresolved names as errors. Single-file compile emits esm:/cjs: package imports without resolving installed packages.

run builds in a temporary directory, calls exported main with an argument array,
prints its result, waits for submitted tasks, and closes the Bun process pool.
Parallel targets must be closed module-level functions, defined locally or imported
from local Kalandra modules. Named aliases, re-exports, and immutable namespaces work.
serve hosts a trusted compiled deployment on 127.0.0.1 (default: ephemeral port).
Tokens come from KALANDRA_REMOTE_TOKEN or --token-env, never command arguments.
--bindings supplies version 1 endpoint JSON with url and tokenEnv per contract.
SIGINT/SIGTERM cancel submitted tasks and wait for cleanup.`);
} else if (
  command === "new" &&
  args.length === 2 &&
  args[1]?.trim() &&
  !args[1].startsWith("-")
) {
  const { createProject } = await import("./new.js");
  await createProject(args[1]);
} else if (
  command &&
  [
    "parse",
    "check",
    "compile",
    "build",
    "run",
    "fmt",
    "docs",
    "highlight",
  ].includes(command) &&
  args[1] &&
  !args[1].endsWith(".kalandra")
) {
  console.error("Source files must use the .kalandra extension");
  process.exitCode = 1;
} else if (command === "highlight" && args[1] && !args[1].startsWith("-")) {
  const { highlightFile } = await import("./highlight.js");
  await highlightFile(args[1], args.slice(2));
} else if (command === "docs" && args[1] && !args[1].startsWith("-")) {
  const { showSourceDocs } = await import("./docs.js");
  await showSourceDocs(args[1], args.slice(2));
} else if (
  command === "install" &&
  args.length <= 2 &&
  !args[1]?.startsWith("-")
) {
  const { installProject } = await import("./install.js");
  await installProject(args[1]);
} else if (
  command === "fmt" &&
  args[1] &&
  (args.length === 2 ||
    (args.length === 3 && ["--check", "--write"].includes(args[2]!)))
) {
  const { formatFile } = await import("./format.js");
  await formatFile(
    args[1],
    args[2] === "--check"
      ? "check"
      : args[2] === "--write"
        ? "write"
        : "stdout",
  );
} else if (command === "serve" && args[1] && !args[1].startsWith("-")) {
  const { serveProject } = await import("./remote.js");
  await serveProject(args[1], args.slice(2));
} else if (command === "run" && args[1] && flags) {
  const { runProject } = await import("./run.js");
  await runProject(args[1], flags.strict, flags.programArgs, flags.bindings);
} else if (command === "build" && args[1] && flags?.output) {
  if (flags.watch) {
    const { watchProject } = await import("./watch.js");
    await watchProject(args[1], flags.output, flags.strict);
  } else {
    const { buildProject } = await import("./build.js");
    await buildProject(
      args[1],
      flags.output,
      flags.strict,
      false,
      undefined,
      flags.remoteServices,
    );
  }
} else if (
  command &&
  ["parse", "check", "compile"].includes(command) &&
  args[1] &&
  flags
) {
  const path = args[1];
  let text: string | undefined;
  try {
    text = await Bun.file(path).text();
  } catch {
    console.error(`Cannot read source file: ${path}`);
    process.exitCode = 1;
  }
  if (text !== undefined) {
    const { parse, analyze, compile } = await import("@kalandra/compiler");
    const source = { path: command === "compile" ? resolve(path) : path, text };
    const result =
      command === "compile"
        ? compile(source, { strictNames: flags.strict })
        : command === "check"
          ? analyze(source, { strictNames: flags.strict })
          : parse(source);
    for (const diagnostic of result.diagnostics) {
      const offset = diagnostic.span?.start ?? 0;
      const prefix = text.slice(0, offset);
      const line = prefix.split("\n").length;
      const column = offset - prefix.lastIndexOf("\n");
      console.error(
        `${path}:${line}:${column} ${diagnostic.code} (${diagnostic.severity}): ${diagnostic.message}`,
      );
    }
    if (
      result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    )
      process.exitCode = 1;
    else if (command === "compile" && "output" in result && result.output) {
      if (!flags.output) {
        const map = Buffer.from(result.output.sourceMap).toString("base64");
        console.log(
          `${result.output.code}\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${map}`,
        );
      } else {
        try {
          const output = resolve(flags.output),
            mapPath = `${output}.map`;
          const identity = async (file: string) =>
            realpath(file).catch(() => resolve(file));
          const sourcePath = await identity(path);
          if (
            (await identity(output)) === sourcePath ||
            (await identity(mapPath)) === sourcePath
          )
            throw new Error("Output must not overwrite the source file");
          if ((await identity(output)) === (await identity(mapPath)))
            throw new Error("JavaScript and source map must be separate files");
          await mkdir(dirname(output), { recursive: true });
          const map = {
            ...JSON.parse(result.output.sourceMap),
            file: basename(output),
          };
          await Bun.write(mapPath, JSON.stringify(map) + "\n");
          await Bun.write(
            output,
            `${result.output.code}\n//# sourceMappingURL=${encodeURIComponent(basename(mapPath))}\n`,
          );
          console.log(`Compiled ${path} → ${flags.output}`);
        } catch (error) {
          console.error(
            `Cannot write compiler output: ${error instanceof Error ? error.message : String(error)}`,
          );
          process.exitCode = 1;
        }
      }
    } else if (command === "parse" && "program" in result)
      console.log(JSON.stringify(result.program, null, 2));
    else
      console.log(
        `Checked ${path}: no known errors (${result.diagnostics.length} warnings; single-file analysis).`,
      );
  }
} else {
  console.error("Unknown argument. Run bun run cli --help.");
  process.exitCode = 1;
}
