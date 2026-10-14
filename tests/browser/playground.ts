import { guideExamples } from "../../apps/website/src/lib/guide/examples.js";
import {
  startPlayground,
  type PlaygroundEvent,
} from "../../apps/website/src/lib/playground/client.js";
import { examples } from "../../apps/website/src/lib/playground/examples.js";

const results: { name: string; passed: boolean; error?: string }[] = [];
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
async function test(name: string, body: () => Promise<void>) {
  try {
    await body();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
  }
  document.querySelector("#results")!.textContent = results
    .map(
      (result) =>
        `${result.passed ? "PASS" : "FAIL"} ${result.name}${result.error ? ": " + result.error : ""}`,
    )
    .join("\n");
}
function run(
  source: string,
  observe?: (event: PlaygroundEvent, stop: () => void) => void,
) {
  return new Promise<PlaygroundEvent[]>((resolve, reject) => {
    const events: PlaygroundEvent[] = [];
    const timer = setTimeout(() => {
      execution.stop();
      reject(new Error("Playground did not settle"));
    }, 15_000);
    const execution = startPlayground(source, (event) => {
      events.push(event);
      observe?.(event, () => execution.stop());
      if (["result", "error", "invalid", "stopped"].includes(event.kind)) {
        clearTimeout(timer);
        resolve(events);
      }
    });
  });
}
const result = (events: PlaygroundEvent[]) =>
  events
    .filter(
      (event): event is Extract<PlaygroundEvent, { text: string }> =>
        event.kind === "result",
    )
    .at(-1);
const error = (events: PlaygroundEvent[]) =>
  events
    .filter(
      (event): event is Extract<PlaygroundEvent, { text: string }> =>
        event.kind === "error",
    )
    .at(-1);
async function cleaned() {
  const limit = Date.now() + 2000;
  while (
    document.querySelector('iframe[title="Isolated Kalandra execution"]')
  ) {
    if (Date.now() > limit) throw new Error("Execution frame leaked");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

for (const [index, expected] of [
  [0, "[3, 5, 7]"],
  [1, "42"],
  [2, "[[2, 4], [6, 8]]"],
  [3, "[1.5, 2.5, 3.5]"],
] as const) {
  await test(`Tiramisu example: ${examples[index].name}`, async () => {
    const events = await run(examples[index].source);
    assert(result(events)?.text === expected, JSON.stringify(events));
    if (index === 1)
      assert(
        events.some(
          (event) =>
            event.kind === "output" && event.text.includes("Hello, Kalandra!"),
        ),
        "Missing console output",
      );
    await cleaned();
  });
}
for (const example of guideExamples.filter((example) => example.browser)) {
  await test(`language guide in playground: ${example.name}`, async () => {
    const events = await run(example.files["main.kalandra"]!);
    const actual = result(events);
    assert(
      actual &&
        JSON.stringify(JSON.parse(actual.text)) ===
          JSON.stringify(example.expected),
      JSON.stringify(events),
    );
    await cleaned();
  });
}
await test("syntax and type errors produce diagnostics without execution", async () => {
  for (const source of [
    "fn broken:",
    'export fn main:\n  Number n = "wrong"\n  n',
  ]) {
    const events = await run(source);
    assert(events.at(-1)?.kind === "invalid", JSON.stringify(events));
    assert(
      events.some(
        (event) =>
          event.kind === "diagnostics" &&
          event.diagnostics.some((d) => d.severity === "error"),
      ),
      "Missing diagnostic",
    );
    assert(
      !events.some((event) => event.kind === "running"),
      "Invalid source executed",
    );
    await cleaned();
  }
});
await test("Stop interrupts a running main loop and restart uses a fresh frame", async () => {
  const source =
    'fn loop n: loop (n + 1)\nexport fn main:\n  console.log "loop started"\n  loop 0';
  let sawOpaqueFrame = false;
  const events = await run(source, (event, stop) => {
    if (event.kind === "output" && event.text.includes("loop started")) {
      const frame = document.querySelector("iframe")!;
      sawOpaqueFrame =
        frame.getAttribute("sandbox") === "allow-scripts" &&
        frame.contentDocument === null;
      setTimeout(stop, 50);
    }
  });
  assert(
    events.at(-1)?.kind === "stopped" && sawOpaqueFrame,
    JSON.stringify(events),
  );
  await cleaned();
  assert(
    result(await run("export fn main: 42"))?.text === "42",
    "Restart failed",
  );
  await cleaned();
});
await test("Stop closes parallel tasks and allows another parallel run", async () => {
  const source =
    '@params Number\n@returns Number\nfn fib n:\n  if n < 2: n\n  else: (fib n - 1) + (fib n - 2)\nexport fn main:\n  console.log "ready"\n  await |fib| 45';
  const events = await run(source, (event, stop) => {
    if (event.kind === "output" && event.text.includes("ready"))
      setTimeout(stop, 250);
  });
  assert(events.at(-1)?.kind === "stopped", JSON.stringify(events));
  await cleaned();
  assert(
    result(await run(examples[0].source))?.text === "[3, 5, 7]",
    "Parallel restart failed",
  );
  await cleaned();
});
await test("whole-run deadline terminates an uncooperative program", async () => {
  const events = await run(examples[4].source);
  assert(events.at(-1)?.kind === "stopped", JSON.stringify(events));
  assert(
    events.some(
      (event) => event.kind === "output" && event.text.includes("10-second"),
    ),
    "Missing deadline message",
  );
  await cleaned();
});
await test("opaque execution origin and CSP block network requests", async () => {
  const origin = await run(
    'export fn main:\n  origin = Function "return self.origin"\n  origin ()',
  );
  assert(result(origin)?.text === '"null"', JSON.stringify(origin));
  const events = await run(
    `export fn main: await fetch "${location.origin}/escape"`,
  );
  assert(error(events), JSON.stringify(events));
  assert(
    (await (await fetch("/escape-count")).json()) === 0,
    "Sandbox made a network request",
  );
  await cleaned();
});
await test("package imports are rejected and runtime failures reach the UI", async () => {
  const imports = await run(
    'from "esm:unavailable" import thing\nexport fn main: thing ()',
  );
  assert(imports.at(-1)?.kind === "invalid", JSON.stringify(imports));
  const runtime = await run("export fn main: missing ()");
  assert(error(runtime)?.text.includes("missing"), JSON.stringify(runtime));
  await cleaned();
});
await test("oversize source is rejected and console output stays bounded", async () => {
  const oversized = await run(" ".repeat(65537));
  assert(error(oversized)?.text.includes("64 KiB"), JSON.stringify(oversized));
  const output = await run(
    'export fn main:\n  console.log ("x" -> .repeat 100000)\n  42',
  );
  assert(result(output)?.text === "42", JSON.stringify(output));
  assert(
    output.every(
      (event) => event.kind !== "output" || event.text.length <= 4000,
    ),
    "Unbounded output",
  );
  await cleaned();
});
document.querySelector("#status")!.textContent =
  `${results.filter((r) => r.passed).length}/${results.length} passed`;
await fetch("/report", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ userAgent: navigator.userAgent, results }),
});
