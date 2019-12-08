const shell = require("shelljs");
const tmp = require("tmp");

test("Runs hello world", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);

  shell.exec("clio new test");
  shell.cd("test");
  const result = shell.exec("clio run index.clio");
  expect(result.toString()).toEqual("Hello World\n");
});
