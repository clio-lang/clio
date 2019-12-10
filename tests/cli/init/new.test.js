const shell = require("shelljs");
const tmp = require("tmp");

test("Create a package", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);
  shell.exec("clio new testproj");
  shell.cd("testproj");
  const files = shell
    .ls()
    .toString()
    .split(",");
  expect(files.includes("cliopkg.toml")).toBe(true);
  expect(files.includes("clio_env")).toBe(true);
});
