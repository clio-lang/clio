const shell = require("shelljs");
const tmp = require("tmp");

test("Create a package", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);
  shell.exec("clio new testproj");
  shell.cd("testproj");
  const output = shell.exec("clio highlight index.clio");
  console.log(output);
  expect(output.includes("print")).toBe(true);
});
