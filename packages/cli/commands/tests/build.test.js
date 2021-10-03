import { _new, build } from "../.js";
import {
  existsSync,
  promises,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { getPackageConfig, writePackageConfig } from "clio-manifest";

import { copyDir } from "../build.js";
import { dirSync } from "tmp";
import { join } from "path";

jest.mock("clio-manifest/npm_dependencies");

process.exit = jest.fn();

describe("Package.json generation", () => {
  test("Build generates package.json", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "web");
    const buildPath = join(dir.name, "build");
    try {
      if (existsSync(buildPath)) {
        deleteFolderRecursive(buildPath);
      }
    } catch (err) {
      console.error(err);
    }

    await build(join(dir.name, "clio.toml"), {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true,
    });

    const file = readFileSync(join(dir.name, "build", "package.json"));
    const pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.main).toBeDefined();
    expect(pkgJsonObj.dependencies).toBeDefined();
    dir.removeCallback();
  });

  test("Overrides package.json if new dependency is added", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "node");
    await build(join(dir.name, "clio.toml"), {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true,
    });

    let file = readFileSync(join(dir.name, "build", "package.json"));
    let pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies).toBeDefined();

    const filePath = join(dir.name, "clio.toml");
    const oldConfig = getPackageConfig(filePath);
    const newConfig = {
      ...oldConfig,
      npm: {
        dependencies: [
          ...(oldConfig.npm?.dependencies || []),
          { name: "express", version: "latest" },
        ],
      },
    };

    writePackageConfig(filePath, newConfig);

    await build(filePath, {
      skipNpmInstall: true,
      skipBundle: true,
      silent: true,
    });

    file = readFileSync(join(dir.name, "build", "package.json"));
    pkgJsonObj = JSON.parse(file.toString());
    expect(pkgJsonObj.dependencies.express).toBeDefined();

    dir.removeCallback();
  });

  test("npm dependencies are installed after build", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "node");
    await build(join(dir.name, "clio.toml"), {
      skipBundle: true,
      silent: true,
    });

    const nodeModulesExists = existsSync(
      join(dir.name, "build", "node_modules")
    );
    expect(nodeModulesExists).toBe(true);
  });
});

describe("Web builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "web");
    await build(join(dir.name, "clio.toml"), { silent: true });
    const files = readdirSync(join(dir.name, "build"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  }, 20000);
});

describe("Build copies non-clio files", () => {
  test("Copy dummy file to dest", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "node");
    writeFileSync(join(dir.name, "src", "dummy"), "dummy");
    await build(join(dir.name, "clio.toml"));
    const files = readdirSync(join(dir.name, "build"));
    expect(files.includes("dummy")).toBe(true);
    dir.removeCallback();
  });
});

describe("Node builds", () => {
  test("with defaults (clio build)", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "node");
    await build(join(dir.name, "clio.toml"), { silent: true });
    const files = readdirSync(join(dir.name, "build"));
    expect(files.includes("main.clio.js")).toBe(true);
    dir.removeCallback();
  });

  test("with alternative target directory (clio build)", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    await _new(dir.name, "js", "node");

    writeFileSync(
      join(dir.name, "clio.toml"),
      `[build]
source = "src"
target = "js"
destination = "build/alternative"
`
    );

    await build(join(dir.name, "clio.toml"), { silent: true });

    const files = readdirSync(join(dir.name, "build", "alternative"));
    expect(files.includes("main.clio.js")).toBe(true);

    dir.removeCallback();
  });
});

describe("copyDir", () => {
  test("copyDir to a new directory", async () => {
    const tempSource = dirSync({ unsafeCleanup: true });

    writeFileSync(join(tempSource.name, "test"), "foo");
    await copyDir(tempSource.name, join(tempSource.name, "out"));
    expect(
      await promises.readdir(join(tempSource.name, "out").toString())
    ).toEqual(["test"]);

    tempSource.removeCallback();
  });

  test("copyDir to an existing directory", async () => {
    const tempSource = dirSync({ unsafeCleanup: true });
    const tempTarget = dirSync({ unsafeCleanup: true });

    writeFileSync(join(tempSource.name, "test"), "foo");
    await copyDir(tempSource.name, tempTarget.name);
    expect(await promises.readdir(join(tempTarget.name).toString())).toEqual([
      "test",
    ]);

    tempSource.removeCallback();
    tempTarget.removeCallback();
  });
});
