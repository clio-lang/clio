const compiler = require("../compiler");
test("Compile code", () => {
  return compiler.compile("[1 2 3] -> print\n").then(out => {
    expect(typeof out).toBe("string");
  });
});

test("Compilation fails", async () => {
  await expect(compiler.compile("1 --> print\n")).rejects.toThrow();
});

test("Compile imports", async () => {
  const input = `import loop from "./loop.clio"\n`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile import fails with unexpected token", async () => {
  const input = `impor loop from "./loop.clio"\n`;

  const output = compiler.compile(input);
  await expect(output).rejects.toThrow();
});

test("Compile loop", async () => {
  const input = `
fn loop i:
  if i < 200000:
    i + 1 -> loop
  else:
    i
  `;

  const output = await compiler.compile(input);
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

  const output = compiler.compile(input);
  await expect(output).rejects.toThrow();
});

test("Compile if elif else", async () => {
  const input = `
fn foo n:
  if n < 2:
    n
  elif n < 4:
    n + 2
  else:
    n + 4
`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile range", async () => {
  const input = `
[0:] => range
[0:10] => range
[0:10:2] => range
[:10:2] => range
[::2] => range
[:10] => range
[:] => range
`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile slicers", async () => {
  const input = `
[1 2 3 4][0] -> print
[1:4][0] -> print
[1 2 3 4][0:2] -> print
[1:4][0:2] -> print
[1 2 3 4 5 6 7 8 9 10][10:0:-2] -> print
[0:11][10:0:-2] -> print
[1 2 3 4 5 6 7 8][[1 2 3]] -> print
[0:11][[1 2 3]] -> print
[[1 2 3]
 [4 5 6]
 [7 8 9]][[0:2] 1] -> print
[[1 2 3]
 [4 5 6]
 [7 8 9]][[0:2] [1]] -> print
`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile hashmaps", async () => {
  const input = `
# widget
    debug 'on'
    info
      title 'Sample widget'
      name 'main'
    dimensions
      width 500
      height 500
-> print
`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile method calls", async () => {
  const input = `data -> .method arg1 arg2\n`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

test("Compile property access", async () => {
  const input = `data.property -> print\n`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});
