import { compileProject } from "../packages/compiler/src/index.js";
import { resolve } from "node:path";
import { browserDefines } from "./browser-build-options.js";
/** Run this separately from `check`: open the printed URL in a real browser. */
const builds = await Promise.all([
  Bun.build({
    entrypoints: ["tests/browser/smoke.ts"],
    target: "browser",
    define: browserDefines,
    format: "esm",
  }),
  Bun.build({
    entrypoints: ["packages/compiler/src/index.ts"],
    target: "browser",
    define: browserDefines,
    format: "esm",
  }),
]);
for (const build of builds)
  if (!build.success) throw new Error(build.logs.join("\n"));
const assets = new Map<string, Blob>();
assets.set("smoke.js", builds[0]!.outputs[0]!);
assets.set("compiler.js", builds[1]!.outputs[0]!);
for (const [path, entry] of [
  ["runtime/index.js", "packages/runtime/hosts/browser/index.ts"],
  ["runtime/worker.js", "packages/runtime/hosts/browser/worker.ts"],
  ["tasks.js", "tests/browser/tasks.ts"],
] as const) {
  if (process.argv.includes("--built") && path.startsWith("runtime/")) {
    const file = Bun.file(
      `dist/${path.replace("runtime/", "runtime/browser/")}`,
    );
    if (!(await file.exists()))
      throw new Error("Run bun run build:packages before --built");
    assets.set(path, file);
  } else {
    const result = await Bun.build({
      entrypoints: [entry],
      target: "browser",
      format: "esm",
    });
    if (!result.success) throw new Error(result.logs.join("\n"));
    assets.set(path, result.outputs[0]!);
  }
}
for (const [name, entry] of [
  ["records", "parallel-records/main.kalandra"],
  ["captures", "parallel-captures/main.kalandra"],
  ["nested", "nested-parallel.kalandra"],
] as const) {
  const result = await compileProject(
    entry,
    {
      async readSource(path) {
        const file = Bun.file(resolve("examples", path));
        if (!(await file.exists())) return null;
        const text = await file.text();
        return name === "nested" && path === entry
          ? text + "\nexport fn single: await |batch| [1 2]\n"
          : text;
      },
    },
    { strictNames: true },
  );
  if (!result.output) throw new Error(JSON.stringify(result.diagnostics));
  for (const [path, file] of result.output.files)
    assets.set(`programs/${name}/${path}`, new Blob([file.code]));
}
assets.set("malformed-worker.js", new Blob(["postMessage({broken:true})"]));
assets.set(
  "broken-worker.js",
  new Blob(['throw new Error("startup failure")']),
);
assets.set(
  "failure-runner.js",
  new Blob([
    'export async function run(dispatch) { await dispatch({module:new URL("./tasks.js",import.meta.url).href,exportName:"echo",args:[42],schema:{args:["number"],result:"number"}}); throw new Error("main failed"); }',
  ]),
);
let started = 0;
const token = crypto.randomUUID();
let complete = false;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`/${token}/`))
      return new Response("Not found", { status: 404 });
    const path = url.pathname.slice(token.length + 2);
    const headers = { "cache-control": "no-store" };
    if (request.method === "GET" && path === "")
      return new Response(
        `<!doctype html><html lang="en"><meta charset="utf-8"><title>Kalandra browser verification</title><body><h1>Kalandra browser verification</h1><p id="status" role="status">Running…</p><pre id="results"></pre><script type="module" src="./smoke.js"></script></body></html>`,
        { headers: { ...headers, "content-type": "text/html" } },
      );
    if (request.method === "GET" && path === "started") {
      started++;
      return new Response("Recorded", { headers });
    }
    if (request.method === "GET" && path === "started-count")
      return Response.json(started, { headers });
    if (request.method === "GET" && assets.has(path))
      return new Response(assets.get(path)!, {
        headers: { ...headers, "content-type": "text/javascript" },
      });
    if (request.method === "POST" && path === "report" && !complete) {
      if (request.headers.get("origin") !== url.origin)
        return new Response("Forbidden", { status: 403 });
      const report = await request.json();
      if (
        !Array.isArray(report.results) ||
        report.results.length === 0 ||
        !report.results.every(
          (item: { passed?: unknown }) => typeof item.passed === "boolean",
        )
      )
        return new Response("Invalid report", { status: 400 });
      complete = true;
      console.log(JSON.stringify(report, null, 2));
      const passed = report.results.every(
        (item: { passed: boolean }) => item.passed,
      );
      process.exitCode = passed ? 0 : 1;
      clearTimeout(deadline);
      setTimeout(() => server.stop(), 100);
      return new Response("Recorded", { headers });
    }
    return new Response("Not found", { status: 404 });
  },
});
const deadline = setTimeout(() => {
  console.error("Browser verification timed out without a report.");
  process.exitCode = 1;
  server.stop(true);
}, 180_000);
console.log(`Open in a browser: ${server.url}${token}/`);
