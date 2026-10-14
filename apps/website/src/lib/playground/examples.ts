import { guideExamples, exampleById } from "../guide/examples.js";

export const examples = [
  {
    id: "parallel",
    name: "Parallel numbers",
    description:
      "Double three numbers in workers. Number keeps its floating-point precision.",
    source: exampleById("parallel")!.files["main.kalandra"]!,
  },
  {
    id: "hello",
    name: "Hello, Kalandra",
    description: "Print a message and return a value from main.",
    source: `export fn main:
  console.log "Hello, Kalandra!"
  6 * 7
`,
  },
  {
    id: "nested",
    name: "Nested parallel work",
    description:
      "Each batch schedules more work through the same bounded pool.",
    source: `list Numbers: Number

@params Number
fn double n: n * 2

@params Numbers
@returns Numbers
fn batch values:
  values -> * [await] |double|

export fn main:
  [[1 2] [3 4]] -> * [await] |batch|
`,
  },
  {
    id: "captures",
    name: "Captured data",
    description: "The worker receives a typed snapshot of offset.",
    source: `Number offset = 0.5

@params Number
fn addOffset n: n + offset

export fn main:
  [1 2 3] -> * [await] |addOffset|
`,
  },
  {
    id: "stop",
    name: "Try the Stop button",
    description:
      "This program loops indefinitely. Stop terminates its execution worker.",
    source: `fn loop n: loop (n + 1)

export fn main:
  loop 0
`,
  },
  ...guideExamples
    .filter((example) => example.browser)
    .map((example) => ({
      id: "guide-" + example.id,
      name: example.name,
      description: example.description,
      source: example.files["main.kalandra"]!,
    })),
] as const;

export function playgroundExampleIndex(search: string): number {
  const id = new URLSearchParams(search).get("example");
  return Math.max(
    0,
    examples.findIndex((example) => example.id === id),
  );
}
