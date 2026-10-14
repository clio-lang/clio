import { browserDefines } from "./browser-build-options.js";
import { mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const name of [
  "compiler",
  "protocol",
  "runtime",
  "language-server",
  "cli",
]) {
  const result = await Bun.build({
    entrypoints:
      name === "cli"
        ? ["packages/cli/src/index.ts", "packages/cli/src/watch-worker.ts"]
        : [`packages/${name}/src/index.ts`],
    outdir: `dist/${name}`,
    target: name === "cli" ? "bun" : "browser",
    define: browserDefines,
    format: "esm",
    sourcemap: "external",
    packages: "bundle",
    external:
      name === "cli"
        ? [
            "../compiler/index.js",
            "../runtime/bun/index.js",
            "../runtime/bun/remote.js",
          ]
        : [],
    plugins:
      name === "cli"
        ? [
            {
              name: "built-workspace-imports",
              setup(build) {
                const paths: Record<string, string> = {
                  "@kalandra/compiler": "../compiler/index.js",
                  "@kalandra/runtime/bun": "../runtime/bun/index.js",
                  "@kalandra/runtime/bun/remote": "../runtime/bun/remote.js",
                };
                build.onResolve(
                  {
                    filter: /^@kalandra\/(compiler|runtime\/bun(?:\/remote)?)$/,
                  },
                  ({ path }) => ({ path, namespace: "built-workspace" }),
                );
                // Explicit re-exports keep the CLI linked to its sibling build artifacts.
                build.onLoad(
                  { filter: /.*/, namespace: "built-workspace" },
                  ({ path }) => ({
                    loader: "js",
                    contents: `export { ${path === "@kalandra/compiler" ? "compileProject, parse, analyze, compile, formatSource, sourceDocumentation, tokenize" : path.endsWith("/remote") ? "loadRemoteDeployment, serveRemoteTasks, loadRemoteImportDispatcher" : "runBunProgram, createBunWorkerPool"} } from ${JSON.stringify(paths[path])};`,
                  }),
                );
              },
            },
          ]
        : [],
  });
  if (!result.success) {
    console.error(...result.logs);
    process.exit(1);
  }
}
console.log(
  "Built workspace packages, including the experimental authenticated Bun remote adapter.",
);

for (const entry of ["index", "worker", "remote"]) {
  const result = await Bun.build({
    entrypoints: [`packages/runtime/hosts/bun/${entry}.ts`],
    outdir: "dist/runtime/bun",
    target: "bun",
    format: "esm",
    sourcemap: "external",
    packages: "bundle",
  });
  if (!result.success)
    throw new Error(
      `Cannot build Bun runtime ${entry}: ${result.logs.join("\n")}`,
    );
}

const languageServer = await Bun.build({
  entrypoints: ["packages/language-server/src/stdio.ts"],
  outdir: "dist/language-server",
  target: "bun",
  format: "esm",
  sourcemap: "external",
  packages: "bundle",
  define: browserDefines,
});
if (!languageServer.success) throw new Error(languageServer.logs.join("\n"));

for (const entry of ["index", "worker"]) {
  const result = await Bun.build({
    entrypoints: [`packages/runtime/hosts/browser/${entry}.ts`],
    outdir: "dist/runtime/browser",
    target: "browser",
    format: "esm",
    sourcemap: "external",
    packages: "bundle",
  });
  if (!result.success)
    throw new Error(
      `Cannot build browser runtime ${entry}: ${result.logs.join("\n")}`,
    );
}
