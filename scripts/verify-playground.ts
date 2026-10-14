/** Browser-only checks of the actual sandbox client and built playground assets. */
import { resolve } from "node:path";
await import("./build-playground.js");
const build = await Bun.build({
  entrypoints: ["tests/browser/playground.ts"],
  target: "browser",
  format: "esm",
});
if (!build.success) throw new Error(build.logs.join("\n"));
let escapes = 0;
let completed = false;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/")
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Kalandra playground checks</title><h1>Kalandra playground checks</h1><p id="status">Running…</p><pre id="results"></pre><script type="module" src="/test.js"></script>',
        { headers: { "content-type": "text/html" } },
      );
    if (url.pathname === "/test.js")
      return new Response(build.outputs[0]!, {
        headers: { "content-type": "text/javascript" },
      });
    if (/^\/playground\/(sandbox|compiler|worker)\.js$/.test(url.pathname))
      return new Response(
        Bun.file(resolve("apps/website/static", url.pathname.slice(1))),
        { headers: { "content-type": "text/javascript" } },
      );
    if (url.pathname === "/escape") {
      escapes++;
      return new Response("Unexpected network access");
    }
    if (url.pathname === "/escape-count") return Response.json(escapes);
    if (url.pathname === "/report" && request.method === "POST" && !completed) {
      if (request.headers.get("origin") !== url.origin)
        return new Response("Forbidden", { status: 403 });
      const report = await request.json();
      if (!Array.isArray(report.results) || report.results.length === 0)
        return new Response("Invalid report", { status: 400 });
      completed = true;
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.results.every(
        (r: { passed: boolean }) => r.passed === true,
      )
        ? 0
        : 1;
      clearTimeout(timer);
      setTimeout(() => server.stop(true), 100);
      return new Response("Recorded");
    }
    return new Response("Not found", { status: 404 });
  },
});
const timer = setTimeout(() => {
  process.exitCode = 1;
  server.stop(true);
}, 180_000);
console.log(`Open in a browser: ${server.url}`);
