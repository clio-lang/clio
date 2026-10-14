export interface GuideExample {
  id: string;
  name: string;
  description: string;
  files: Readonly<Record<string, string>>;
  expected: unknown;
  browser: boolean;
}

/** The guide, playground and execution tests all consume these exact sources. */
export const guideExamples: readonly GuideExample[] = [
  {
    id: "first-program",
    name: "Your first program",
    description: "Return a value from main using a named binding.",
    files: {
      "main.kalandra": `export fn main:
  answer = 6 * 7
  answer
`,
    },
    expected: 42,
    browser: true,
  },
  {
    id: "functions",
    name: "Functions and pipes",
    description: "Compose ordinary calls and retain values in a closure.",
    files: {
      "main.kalandra": `fn double n: n * 2

fn addOffset offset:
  fn add n: n + offset
  add

export fn main:
  addThree = addOffset 3
  10 -> double -> addThree
`,
    },
    expected: 23,
    browser: true,
  },
  {
    id: "collections",
    name: "Arrays and maps",
    description: "Map a function over an array, then update one element.",
    files: {
      "main.kalandra": `fn double n: n * 2

export fn main:
  values = [1 2 3] -> * double
  values[1] = 42
  values
`,
    },
    expected: [2, 42, 6],
    browser: true,
  },
  {
    id: "types",
    name: "Types and records",
    description: "Declare a record and check a typed function call.",
    files: {
      "main.kalandra": `type Point:
  Number x
  Number y

@params Point
@returns Number
@check
fn sum point: point.x + point.y

export fn main:
  point = Point 1.5 2.5
  sum point
`,
    },
    expected: 4,
    browser: true,
  },
  {
    id: "modules",
    name: "Local modules",
    description: "Import an exported function from another source file.",
    files: {
      "main.kalandra": `from "./math" import double

export fn main: double 21
`,
      "math.kalandra": `export fn double n: n * 2
`,
    },
    expected: 42,
    browser: false,
  },
  {
    id: "parallel",
    name: "Typed parallel calls",
    description: "Map typed work to workers and await all of its results.",
    files: {
      "main.kalandra": `@params Number
fn double n: n * 2

export fn main:
  [1.5 2.5 3.5] -> * [await] |double|
`,
    },
    expected: [3, 5, 7],
    browser: true,
  },
];
export const exampleById = (id: string) =>
  guideExamples.find((example) => example.id === id);
