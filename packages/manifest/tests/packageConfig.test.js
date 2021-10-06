import { dirname, join } from "path";
import { getPackageConfig, writePackageConfig } from "../index.js";

import { dirSync } from "tmp";
import { fileURLToPath } from "url";
import { parse } from "@iarna/toml";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("Import config file", () => {
  const config = getPackageConfig(join(__dirname, "clio.test.toml"));
  expect(config.title).toBeDefined();
});

test("Write config file", () => {
  const config = {
    title: "test",
    dependencies: [{ name: "Foo", version: "1.2.3" }],
  };

  const tmpDir = dirSync({ unsafeCleanup: true });
  const filePath = join(tmpDir.name, "clio.toml");

  writePackageConfig(filePath, config);

  const file = readFileSync(filePath);
  const contents = parse(file.toString());
  expect(contents.title).toBe("test");
  expect(contents.dependencies).toEqual({ Foo: "1.2.3" });
  tmpDir.removeCallback();
});

test("Toml contains npm.dependencies", () => {
  const config = getPackageConfig(join(__dirname, "clio.test.toml"));

  expect(config.npm.dependencies).toContainEqual({
    name: "rickroll",
    version: "latest",
  });
});

test("Toml contains npm.devDependencies", () => {
  const config = getPackageConfig(join(__dirname, "clio.test.toml"));

  expect(config.npm.devDependencies).toContainEqual({
    name: "parcel",
    version: "next",
  });
});

test("Toml contains builds and targets", () => {
  const config = getPackageConfig(join(__dirname, "clio.test.toml"));
  expect(config.build).toBeDefined();
  expect(config.build.target).toBeDefined();
  expect(config.build.directory).toBeDefined();

  expect(config.target).toBeDefined();
  expect(config.target.node).toBeDefined();
  expect(config.target.node.directory).toBeDefined();

  expect(config.target.node).toBeDefined();
  expect(config.target["browser"].directory).toBeDefined();
});
