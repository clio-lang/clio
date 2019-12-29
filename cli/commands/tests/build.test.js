const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const { build, _new } = require("../");

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
      path.join(dir.name, "clio.toml"),
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
    expect(false).toBe(true);
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
