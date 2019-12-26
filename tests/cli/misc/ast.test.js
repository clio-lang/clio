const tmp = require("tmp");
const path = require("path");
const { createPackage } = require("../../../cli/commands/new");
const { printAst } = require("../../../cli/commands/ast");

test("Print AST", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, "index.clio");
  const ast = await printAst(source);
  expect(ast.pop()).toContain("name: clio\n");
  dir.removeCallback();
});
