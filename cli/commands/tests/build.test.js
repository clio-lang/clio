const fs = require("fs");
const path = require("path");
const tmp = require("tmp");

const { build, _new } = require("../");

jest.unmock("../../../package/index");

const packageConfig = require("../../../package/index");
packageConfig.fetchNpmDependencies = jest
  .fn()
  .mockImplementation(async destination => {
    return fs.promises
      .mkdir(path.join(destination, "node_modules", "rickroll"), {
        recursive: true
      })
      .then(() => {
        return fs.promises.writeFile(
          path.join(destination, "node_modules", "rickroll", "rickroll.js"),
          "console.log()",
          {}
        );
      });
  });

describe("Package.json generation", () => {
  test("Build generates package.json", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "browser");
    const buildPath = path.join(dir.name, "build");
    try {
      if (fs.existsSync(buildPath)) {
        deleteFolderRecursive(buildPath);
      }
    } catch (err) {
      console.error(err);
    }

    await build(dir.name);
    const file = fs.readFileSync(
      path.join(dir.name, "build/browser", "package.json")
    );
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies).toBeDefined();

    // As discussed here: https://github.com/clio-lang/clio/pull/93#issuecomment-569831620
    expect(pkgJsonObj.scripts.build).toBeDefined();
    expect(pkgJsonObj.scripts.run).toBeDefined();

    dir.removeCallback();
  });

  test("Build skips generation of package.json when already defined", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "browser");
    const buildPath = path.join(dir.name, "build");
    try {
      if (fs.existsSync(buildPath)) {
        deleteFolderRecursive(buildPath);
      }
    } catch (err) {
      console.error(err);
    }

    await build(dir.name);

    const file = fs.readFileSync(
      path.join(dir.name, "build/browser", "package.json")
    );
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies).toBeDefined();
    dir.removeCallback();
  });

  test("npm dependencies are installed after build", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    const buildPath = path.join(dir.name, "build");
    try {
      if (fs.existsSync(buildPath)) {
        deleteFolderRecursive(buildPath);
      }
    } catch (err) {
      console.error(err);
    }

    await build(dir.name);

    const nodeModulesExists = fs.existsSync(
      path.join(dir.name, "build/node/node_modules")
    );
    expect(nodeModulesExists).toBe(true);
    dir.removeCallback();
  });
});

describe("Browser builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "browser");
    await build(dir.name);
    const files = fs.readdirSync(path.join(dir.name, "build/browser/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with target override (clio build --target=browser)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node"); // project generated as node
    await build(dir.name, undefined, "browser"); // but compiled as browser
    const files = fs.readdirSync(path.join(dir.name, "build/browser/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with destination override (clio build --destination=another-path)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "browser");
    await build(dir.name, "another-path");
    const files = fs.readdirSync(path.join(dir.name, "another-path/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });
});

describe("Node builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name);
    const files = fs.readdirSync(path.join(dir.name, "build/node/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with alternative target directory (clio build)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    fs.writeFileSync(
      path.join(dir.name, packageConfig.CONFIGFILE_NAME),
      `
    [build]
directory = "build"
target = "node"

[target.node]
directory = "src"
target = "alternative"`
    );
    await build(dir.name);

    const files = fs.readdirSync(path.join(dir.name, "build/alternative/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with target override (clio build --target=node)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "browser"); // project generated as browser
    await build(dir.name, undefined, "node"); // but compiled as node
    const files = fs.readdirSync(path.join(dir.name, "build/node/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with destination override (clio build --destination=another-path)", async () => {
    const dir = tmp.dirSync();
    await _new(dir.name, "node");
    await build(dir.name, "another-path");
    const files = fs.readdirSync(path.join(dir.name, "another-path/src"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });
});

const deleteFolderRecursive = path => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(file => {
      const curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};
