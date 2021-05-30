const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const { build, _new } = require("../");
const { copyDir } = require("../build");
const {
  CONFIGFILE_NAME,
  getPackageConfig,
  writePackageConfig,
} = require("clio-manifest");

jest.mock("clio-manifest/npm_dependencies");

process.exit = jest.fn();

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
      silent: true,
    });
    const file = fs.readFileSync(
      path.join(dir.name, "build", "web", "package.json")
    );
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.main).toBeDefined();
    expect(pkgJsonObj.dependencies).toBeDefined();
    dir.removeCallback();
  });

  test("Overrides package.json if new dependency is added", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true,
    });

    let file = fs.readFileSync(
      path.join(dir.name, "build", "node", "package.json")
    );
    let pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies).toBeDefined();

    const oldConfig = getPackageConfig(path.join(dir.name, "clio.toml"));
    const newConfig = {
      ...oldConfig,
      // eslint-disable-next-line camelcase
      npm: {
        dependencies: [
          ...(oldConfig.npm.dependencies || []),
          { name: "express", version: "latest" },
        ],
      },
    };

    writePackageConfig(newConfig, dir.name);

    await build(dir.name, null, {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true,
    });

    file = fs.readFileSync(
      path.join(dir.name, "build", "node", "package.json")
    );
    pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies.express).toBeDefined();

    dir.removeCallback();
  });

  test("npm dependencies are installed after build", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, {
      skipBundle: true,
      silent: true,
    });

    const nodeModulesExists = fs.existsSync(
      path.join(dir.name, "build", "node", "node_modules")
    );
    expect(nodeModulesExists).toBe(true);
  });
});

describe("Web builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "web");
    await build(dir.name, null, { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "build", "web"));
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
    const files = fs.readdirSync(path.join(dir.name, "build", "node"));
    expect(files.includes("dummy")).toBe(true);
    dir.removeCallback();
  });
});

describe("Node builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, null, { silent: true });
    const files = fs.readdirSync(path.join(dir.name, "build", "node"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with alternative target directory (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    fs.writeFileSync(
      path.join(dir.name, CONFIGFILE_NAME),
      `
main = "src/main.clio"

[build]
directory = "build"
target = "node"

[target.node]
directory = "src"
target = "alternative"`
    );
    await build(dir.name, null, { silent: true });

    const files = fs.readdirSync(path.join(dir.name, "build", "alternative"));
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

describe("copyDir", () => {
  test("copyDir to a new directory", async () => {
    const tempSource = tmp.dirSync();

    fs.writeFileSync(path.join(tempSource.name, "test"), "foo");
    await copyDir(tempSource.name, path.join(tempSource.name, "out"));
    expect(
      await fs.promises.readdir(path.join(tempSource.name, "out").toString())
    ).toEqual(["test"]);

    tempSource.removeCallback();
  });

  test("copyDir to an existing directory", async () => {
    const tempSource = tmp.dirSync();
    const tempTarget = tmp.dirSync();

    fs.writeFileSync(path.join(tempSource.name, "test"), "foo");
    await copyDir(tempSource.name, tempTarget.name);
    expect(
      await fs.promises.readdir(path.join(tempTarget.name).toString())
    ).toEqual(["test"]);

    tempSource.removeCallback();
    tempTarget.removeCallback();
  });
});
