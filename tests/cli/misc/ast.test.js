const tmp = require("tmp");
const path = require('path');
const { createPackage } = require('../../../cli/commands/new');
const { printAst } = require('../../../cli/commands/ast');

test("Print AST", async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const source = path.join(dir.name, 'index.clio');
  const ast = printAst(source);
  expect(ast.toString()).toContain("tokens\n");
  expect(ast.toString()).toContain("eof\n");
});
