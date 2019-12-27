const tmp = require("tmp");
const path = require("path");
const { createPackage } = require("../new");
const { printAst } = require("../ast");

test("Print AST", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, "src/main.clio");
  const ast = await printAst(source);
  expect(ast.pop()).toContain("name: clio\n");
  dir.removeCallback();
});
