const compiler = require("../../core/compiler");
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
  else:
    n + 4
`;

  const output = await compiler.compile(input);
  expect(output).toBeDefined();
});

// TODO: if elif else test
