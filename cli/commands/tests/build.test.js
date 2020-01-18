const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const { build, _new } = require("../");
const { CONFIGFILE_NAME } = require("../../../package/index");

jest.mock("../../../package/npm_dependencies");

describe("Package.json generation", () => {
  test("Build generates package.json", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "web");
    const buildPath = path.join(dir.name, "build");
    try {
      if (fs.existsSync(buildPath)) {
        deleteFolderRecursive(buildPath);
      }
    } catch (err) {
      console.error(err);
    }

    await build(dir.name, null, {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true
    });
    const file = fs.readFileSync(
      path.join(dir.name, "build/web", "package.json")
    );
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.main).toBeDefined();
    expect(pkgJsonObj.dependencies).toBeDefined();
    dir.removeCallback();
  });

  test("Build skips generation of package.json when already defined", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true
    });

    const file = fs.readFileSync(
      path.join(dir.name, "build/node", "package.json")
    );
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies).toBeDefined();
    dir.removeCallback();
  });

  test("npm dependencies are installed after build", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, {
      skipBundle: true,
      silent: true
    });

    const nodeModulesExists = fs.existsSync(
      path.join(dir.name, "build/node/node_modules")
    );
    expect(nodeModulesExists).toBe(true);
  });
});

describe("Web builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "web");
    await build(dir.name, null, { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "build/web"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  }, 20000);

  test("with target override (clio build --target=web)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node"); // project generated as node
    await build(dir.name, null, { targetOverride: "web", silent: true }); // but compiled as web
    const files = fs.readdirSync(path.join(dir.name, "build/web"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  }, 20000);

  test("with destination override (clio build --destination=another-path)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "web");
    await build(dir.name, "another-path", { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "another-path"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  }, 20000);
});

describe("Build copies non-clio files", () => {
  test("Copy dummy file to dest", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    fs.writeFileSync(path.join(dir.name, "src", "dummy"), "dummy");
    await build(dir.name);
    const files = fs.readdirSync(path.join(dir.name, "build/node"));
    expect(files.includes("dummy")).toBe(true);
    dir.removeCallback();
  });
});

describe("Node builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "build/node"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with alternative target directory (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    fs.writeFileSync(
      path.join(dir.name, CONFIGFILE_NAME),
      `
    [build]
directory = "build"
target = "node"

[target.node]
directory = "src"
target = "alternative"`
    );
    await build(dir.name, null, { silent: true });

    const files = fs.readdirSync(path.join(dir.name, "build/alternative"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with target override (clio build --target=node)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "web"); // project generated as web
    await build(dir.name, null, { targetOverride: "node", silent: true }); // but compiled as node
    const files = fs.readdirSync(path.join(dir.name, "build/node"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with destination override (clio build --destination=another-path)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, "another-path", { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "another-path"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });
});
