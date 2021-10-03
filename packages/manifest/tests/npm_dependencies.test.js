import {
  getParsedNpmDependencies,
  getParsedNpmDevDependencies,
  hasInstalledNpmDependencies,
} from "../npm_dependencies.js";

import { dirSync } from "tmp";
import { join } from "path";
import { writeFileSync } from "fs";

describe("#hasInstalledNpmDependencies", () => {
  test("should return true if directory has a package-lock.json", () => {
    const dir = dirSync({ unsafeCleanup: true });
    writeFileSync(join(dir.name, "package-lock.json"), "testing");
    expect(hasInstalledNpmDependencies(dir.name)).toBe(true);
  });

  test("should return false if directory has a package-lock.json", () => {
    const dir = dirSync({ unsafeCleanup: true });
    expect(hasInstalledNpmDependencies(dir.name)).toBe(false);
  });
});

describe("#getParsedNpmDependencies", () => {
  test("should return an object with parsed dependencies for section with declared dependencies", () => {
    const dir = dirSync({ unsafeCleanup: true });
    const content = `
    [npm.dependencies]
    http-server="1.0.0"
    express="^1.5.2"
    chalk="2.1.x"
    `;

    const filePath = join(dir.name, "clio.toml");
    writeFileSync(filePath, content);

    const parsedNpmDependencies = getParsedNpmDependencies(filePath);
    expect(parsedNpmDependencies).toEqual({
      "http-server": "1.0.0",
      express: "^1.5.2",
      chalk: "2.1.x",
    });
  });

  describe("#getParsedNpmDevDependencies", () => {
    test("should return an object with parsed dependencies for section with declared dependencies", () => {
      const dir = dirSync({ unsafeCleanup: true });
      const content = `
    [npm.devDependencies]
    http-server="1.0.0"
    express="^1.5.2"
    chalk="2.1.x"
    `;
      const filePath = join(dir.name, "clio.toml");
      writeFileSync(filePath, content);

      const parsedNpmDependencies = getParsedNpmDevDependencies(filePath);
      expect(parsedNpmDependencies).toEqual({
        "http-server": "1.0.0",
        express: "^1.5.2",
        chalk: "2.1.x",
      });
    });
  });

  test("should return an empty object for declared section, but no dependencies", () => {
    const dir = dirSync({ unsafeCleanup: true });
    const content = `
    [npm.dependencies]
    `;
    const filePath = join(dir.name, "clio.toml");
    writeFileSync(filePath, content);

    const parsedNpmDependencies = getParsedNpmDevDependencies(filePath);
    expect(parsedNpmDependencies).toEqual({});
  });

  test("should return an empty object for no section at all", () => {
    const dir = dirSync({ unsafeCleanup: true });
    const content = `
    [dependencies]
    stdlib="latest"
    `;
    const filePath = join(dir.name, "clio.toml");
    writeFileSync(filePath, content);

    const parsedNpmDependencies = getParsedNpmDevDependencies(filePath);
    expect(parsedNpmDependencies).toEqual({});
  });
});
