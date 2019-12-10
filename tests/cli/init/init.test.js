const shell = require("shelljs");
const tmp = require("tmp");

test("Inits a package", () => {
  const dir = tmp.dirSync();
  shell.cd(dir.name);
  shell.mkdir("testproj");
  shell.cd("testproj");
  shell.exec("clio init -y");
  const files = shell
    .ls()
    .toString()
    .split(",");
  expect(files.includes("cliopkg.toml")).toBe(true);
});
