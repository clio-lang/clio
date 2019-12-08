const shell = require("shelljs");
const tmp = require("tmp");

test("Print AST", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);

  shell.exec("clio new test");
  shell.cd("test");
  const ast = shell.exec("clio ast index.clio");
  console.log("AST:", ast);
  expect(JSON.stringify(ast)).toBeDefined();
});
