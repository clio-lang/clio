import { verifyBrowserParallel } from "./parallel.js";
import { compile, compileProject } from "../../packages/compiler/src/index.js";

const results: { name: string; passed: boolean; error?: string }[] = [];
const urls: string[] = [];
const check = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
};
function moduleUrl(code: string) {
  const url = URL.createObjectURL(
    new Blob([code], { type: "text/javascript" }),
  );
  urls.push(url);
  return url;
}
async function execute(text: string) {
  const result = compile({ path: "browser.kalandra", text });
  check(
    result.diagnostics.filter((item) => item.severity === "error"),
    [],
  );
  if (!result.output) throw new Error("Compiler produced no output");
  return import(/* @vite-ignore */ moduleUrl(result.output.code));
}
async function test(name: string, run: () => unknown | Promise<unknown>) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
  document.querySelector("#results")!.textContent = results
    .map(
      (item) =>
        `${item.passed ? "PASS" : "FAIL"} ${item.name}${item.error ? `: ${item.error}` : ""}`,
    )
    .join("\n");
}

await test("semantic errors prevent emission", () => {
  const result = compile({
    path: "invalid.kalandra",
    text: 'Number n = "bad"',
  });
  check(result.output, undefined);
  check(
    result.diagnostics.some((item) => item.code === "KAL3111"),
    true,
  );
});
await test("native ESM, arithmetic and lexical closures", async () => {
  const module = await execute(
    "export fn outer x:\n  fn inner y: x + y\n  inner",
  );
  check(module.outer(7)(3), 10);
});
await test("100,000 tail calls preserve stack space", async () => {
  const module = await execute(
    "export fn sum n total:\n  if n > 0: sum (n - 1) (total + n)\n  else: total",
  );
  check(module.sum(100000, 0), 5000050000);
});
await test("async call-target bindings preserve evaluation order", async () => {
  const module = await execute(
    "export fn run make read: (await make () => target) (read 3 => value)",
  );
  const seen: string[] = [];
  check(
    await module.run(
      async () => {
        seen.push("target");
        return (n: number) => n * 2;
      },
      (n: number) => {
        seen.push("argument");
        return n;
      },
    ),
    6,
  );
  check(seen, ["target", "argument"]);
});
await test("range compatibility helpers execute in the browser", async () => {
  const module = await execute(
    "fn double x: x * 2\nexport fn mapped: 0..3 -> * double",
  );
  check([...module.mapped()], [0, 2, 4]);
});
await test("indexed writes and method receivers", async () => {
  const module = await execute(
    "export fn update items:\n  items[0] = 42\n  items -> .slice 0",
  );
  const items = [1, 2];
  check(module.update(items), [42, 2]);
  check(items, [42, 2]);
});
await test("source maps retain Unicode source text", () => {
  const text = 'export greeting = "Hello 🌍"';
  const result = compile({ path: "unicode.kalandra", text });
  if (!result.output) throw new Error("Missing output");
  check(JSON.parse(result.output.sourceMap).sourcesContent, [text]);
});
await test("in-memory project compilation uses no filesystem", async () => {
  const sources: Record<string, string> = {
    "main.kalandra": 'from "./value" import answer\nexport answer',
    "value.kalandra": "export answer = 42",
  };
  const result = await compileProject(
    "main.kalandra",
    {
      async readSource(path) {
        return sources[path] ?? null;
      },
    },
    { strictNames: true },
  );
  check(result.diagnostics, []);
  check(result.output?.files.has("main.kalandra.mjs"), true);
  check(result.output?.files.has("value.kalandra.mjs"), true);
});
await test("compiler and generated ESM execute inside a browser module worker", async () => {
  const compiler = new URL("./compiler.js", location.href).href;
  const worker = new Worker(
    moduleUrl(`import {compile} from ${JSON.stringify(compiler)};
    let url;
    try {
      const result = compile({path: "worker.kalandra", text: "export fn double x: x * 2"});
      if (!result.output) throw new Error(JSON.stringify(result.diagnostics));
      url = URL.createObjectURL(new Blob([result.output.code], {type: "text/javascript"}));
      const module = await import(url);
      postMessage({value: module.double(21)});
    } catch (error) { postMessage({error: String(error)}); }
    finally { if (url) URL.revokeObjectURL(url); }`),
    { type: "module" },
  );
  try {
    const value = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Worker timed out")),
        15_000,
      );
      worker.onmessage = ({ data }) => {
        clearTimeout(timeout);
        data.error ? reject(new Error(data.error)) : resolve(data.value);
      };
      worker.onerror = (event) => {
        clearTimeout(timeout);
        reject(new Error(event.message));
      };
    });
    check(value, 42);
  } finally {
    worker.terminate();
  }
});
await verifyBrowserParallel(test, check);
for (const url of urls) URL.revokeObjectURL(url);
const passed = results.filter((item) => item.passed).length;
document.querySelector("#status")!.textContent =
  `${passed}/${results.length} passed`;
const report = { userAgent: navigator.userAgent, results };
try {
  const response = await fetch("./report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
} catch (error) {
  document.querySelector("#status")!.textContent +=
    `; report delivery failed: ${error}`;
}
