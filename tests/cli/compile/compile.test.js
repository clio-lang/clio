const shell = require("shelljs");
const tmp = require("tmp");

test("Compile source to target", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);
  shell.exec("clio new testproj");
  shell.cd("testproj");
  shell.exec("clio compile index.clio ./index.js");
  const files = shell
    .ls()
    .toString()
    .split(",");
  expect(files.includes("index.js")).toBeTruthy();
});
