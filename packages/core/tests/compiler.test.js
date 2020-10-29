const { compile } = require("../index");
test("Compile code", () => {
  const { code } = compile("fn test args:\n  [1 2 3] -> print");
  expect(typeof code).toBe("string");
});

test("Compilation fails", async () => {
  await expect(() => compile("1 --> print\n")).toThrow();
});

test("Compile imports", async () => {
  const input = `import loop from "./loop.clio"\n`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile import fails with unexpected token", async () => {
  const input = `impor loop from "./loop.clio"\n`;
  await expect(() => compile(input)).toThrow();
});

test("Compile loop", async () => {
  const input = `
fn loop i:
  if i < 200000:
    i + 1 -> loop
  else:
    i
  `;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile loop fails with wrong indentation", async () => {
  const input = `
fn loop i:
  if i < 200000:
  i + 1 -> loop
  else:
    i
  `;

  expect(() => compile(input)).toThrow();
});

test("Compile if, else if, else", async () => {
  const input = `
fn foo n:
  if n < 2:
    n
  else if n < 4:
    n + 2
  else:
    n + 4
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile range", async () => {
  const input = `
fn rangeTest start stop step:
  start..stop::step => range
  0.. => range
  0..10 => range
  0..10::2 => range
  ..10::2 => range
  ..::2 => range
  ..10 => range
  .. => range
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile slicers", async () => {
  const input = `
fn compileSlicers args:
  [1 2 3 4][0] -> print
  1..4[0] -> print
  [1 2 3 4][0..2] -> print
  1..4[0..2] -> print
  [1 2 3 4 5 6 7 8 9 10][10..0::-2] -> print
  0..11[10..0::-2] -> print
  [1 2 3 4 5 6 7 8][[1 2 3]] -> print
  0..11[[1 2 3]] -> print
  [[1 2 3]
  [4 5 6]
  [7 8 9]][0..2 1] -> print
  [[1 2 3]
  [4 5 6]
  [7 8 9]][0..2 [1]] -> print
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile hashmaps", async () => {
  const input = `
fn testHash void:
  # widget:
      debug: "on"
      info:
        title: "Sample widget"
        name: "main"
      dimensions:
        width: 500
        height: 500
  -> print
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile logicals", async () => {
  const input = `
fn testLogicals args:
  true -> print
  false -> print
  true or false -> print
  true and false -> print
  true and not false -> print
  not true -> print
  not true or not false -> print
  true or false and true -> print
  10 > 0 or 4 > 0 and 0 > 5 -> print
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile method calls", async () => {
  const input = `
fn compileMethods args:
  data -> .method args
`;

  const output = compile(input);
  expect(output).toBeDefined();
});

test("Compile property access", async () => {
  const input = `
fn compilePropertyAccess args:
  data.property -> print
`;

  const output = compile(input);
  expect(output).toBeDefined();
});
