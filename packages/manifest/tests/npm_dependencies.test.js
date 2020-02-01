const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const {
  hasInstalledNpmDependencies,
  getParsedNpmDependencies
} = require("../npm_dependencies");

describe("#hasInstalledNpmDependencies", () => {
  test("should return true if directory has a package-lock.json", () => {
    const dir = tmp.dirSync();
    fs.writeFileSync(path.join(dir.name, "package-lock.json"), "testing");
    expect(hasInstalledNpmDependencies(dir.name)).toBe(true);
  });

  test("should return false if directory has a package-lock.json", () => {
    const dir = tmp.dirSync();
    expect(hasInstalledNpmDependencies(dir.name)).toBe(false);
  });
});

describe("#getParsedNpmDependencies", () => {
  test("should return an object with parsed dependencies for section with declared dependencies", () => {
    const dir = tmp.dirSync();
    const content = `
    [npm_dependencies]
    http-server="1.0.0"
    express="^1.5.2"
    chalk="2.1.x"
    `;
    fs.writeFileSync(path.join(dir.name, "clio.toml"), content);

    const parserNpmDependencies = getParsedNpmDependencies(dir.name);

    expect(parserNpmDependencies).toEqual({
      "http-server": "1.0.0",
      express: "^1.5.2",
      chalk: "2.1.x"
    });
  });

  test("should return an empty object for declared section, but no dependencies", () => {
    const dir = tmp.dirSync();
    const content = `
    [npm_dependencies]
    `;
    fs.writeFileSync(path.join(dir.name, "clio.toml"), content);

    const parserNpmDependencies = getParsedNpmDependencies(dir.name);

    expect(parserNpmDependencies).toEqual({});
  });

  test("should return an empty object for no section at all", () => {
    const dir = tmp.dirSync();
    const content = `
    [dependencies]
    stdlib="latest"
    `;
    fs.writeFileSync(path.join(dir.name, "clio.toml"), content);

    const parserNpmDependencies = getParsedNpmDependencies(dir.name);

    expect(parserNpmDependencies).toEqual({});
  });
});
