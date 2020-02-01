const { GITHUB_PREFIX, REGISTRY_NAME, URL_PREFIX } = require("../config");
const {
  GITHUB_PATH_RE,
  GITHUB_URI_RE,
  GITHUB_ZIP_RE,
  NAME_RE,
  parsePackageId
} = require("../utils/parse");

const version = "2.3.3";
const branch = "my-branch";
const name = "rethinkdb";
const name_version = "rethinkdb@2.3.3";
const name_branch = "rethinkdb@my-branch";
const githubURI = "github.com/clio-lang/rethinkdb";
const githubURI_branch = "github.com/clio-lang/rethinkdb@my-branch";
const githubURI_version = "github.com/clio-lang/rethinkdb@2.3.3";
const githubZip_branch =
  "https://github.com/clio-lang/rethinkdb/archive/my-branch.zip";
const githubZip_version =
  "https://github.com/clio-lang/rethinkdb/archive/v2.3.3.zip";
const githubPath = "clio-lang/rethinkdb";
const githubPath_branch = "clio-lang/rethinkdb@my-branch";
const githubPath_version = "clio-lang/rethinkdb@2.3.3";

describe("pkgr/utils/parse", () => {
  describe("regexes", () => {
    describe("GITHUB_ZIP_RE", () => {
      test("github uri", () => {
        expect(GITHUB_ZIP_RE.exec(githubURI)).toBe(null);
      });
      test("github uri (version)", () => {
        expect(GITHUB_ZIP_RE.exec(githubURI_version)).toBe(null);
      });
      test("github uri (branch)", () => {
        expect(GITHUB_ZIP_RE.exec(githubURI_branch)).toBe(null);
      });
      test("github path", () => {
        expect(GITHUB_ZIP_RE.exec(githubPath)).toBe(null);
      });
      test("github path (version)", () => {
        expect(GITHUB_ZIP_RE.exec(githubPath_version)).toBe(null);
      });
      test("github path (branch)", () => {
        expect(GITHUB_ZIP_RE.exec(githubPath_branch)).toBe(null);
      });
      test("name", () => {
        expect(GITHUB_ZIP_RE.exec(name)).toBe(null);
      });
      test("name (version)", () => {
        expect(GITHUB_ZIP_RE.exec(name_version)).toBe(null);
      });
      test("name (branch)", () => {
        expect(GITHUB_ZIP_RE.exec(name_branch)).toBe(null);
      });

      test("github zip url (version)", () => {
        expect(GITHUB_ZIP_RE.exec(githubZip_version)).toMatchObject({
          0: "github.com/clio-lang/rethinkdb/archive/v2.3.3.zip",
          1: githubURI,
          2: githubPath,
          3: version
        });
      });
      test("github zip url (branch)", () => {
        expect(GITHUB_ZIP_RE.exec(githubZip_branch)).toMatchObject({
          0: "github.com/clio-lang/rethinkdb/archive/my-branch.zip",
          1: githubURI,
          2: githubPath,
          4: branch
        });
      });
    });

    describe("GITHUB_URI_RE", () => {
      test("github zip url (version)", () => {
        expect(GITHUB_URI_RE.exec(githubZip_version)).toBe(null);
      });
      test("github zip url (branch)", () => {
        expect(GITHUB_URI_RE.exec(githubZip_branch)).toBe(null);
      });
      test("github path", () => {
        expect(GITHUB_URI_RE.exec(githubPath)).toBe(null);
      });
      test("github path (version)", () => {
        expect(GITHUB_URI_RE.exec(githubPath_version)).toBe(null);
      });
      test("github path (branch)", () => {
        expect(GITHUB_URI_RE.exec(githubPath_branch)).toBe(null);
      });
      test("name", () => {
        expect(GITHUB_URI_RE.exec(name)).toBe(null);
      });
      test("name (version)", () => {
        expect(GITHUB_URI_RE.exec(name_version)).toBe(null);
      });
      test("name (branch)", () => {
        expect(GITHUB_URI_RE.exec(name_branch)).toBe(null);
      });

      test("github uri", () => {
        expect(GITHUB_URI_RE.exec(githubURI)).toMatchObject({
          0: githubURI,
          1: githubURI,
          2: githubPath
        });
      });
      test("github uri (version)", () => {
        expect(GITHUB_URI_RE.exec(githubURI_version)).toMatchObject({
          0: githubURI_version,
          1: githubURI,
          2: githubPath,
          3: version
        });
      });
      test("github uri (branch)", () => {
        expect(GITHUB_URI_RE.exec(githubURI_branch)).toMatchObject({
          0: githubURI_branch,
          1: githubURI,
          2: githubPath,
          4: branch
        });
      });
    });

    describe("GITHUB_PATH_RE", () => {
      test("github uri", () => {
        expect(GITHUB_PATH_RE.exec(githubURI)).toBe(null);
      });
      test("github uri (version)", () => {
        expect(GITHUB_PATH_RE.exec(githubURI_version)).toBe(null);
      });
      test("github uri (branch)", () => {
        expect(GITHUB_PATH_RE.exec(githubURI_branch)).toBe(null);
      });
      test("github zip url (version)", () => {
        expect(GITHUB_PATH_RE.exec(githubZip_version)).toBe(null);
      });
      test("github zip url (branch)", () => {
        expect(GITHUB_PATH_RE.exec(githubZip_branch)).toBe(null);
      });
      test(name, () => {
        expect(GITHUB_PATH_RE.exec(name)).toBe(null);
      });
      test("name (version)", () => {
        expect(GITHUB_PATH_RE.exec(name_version)).toBe(null);
      });
      test("name (branch)", () => {
        expect(GITHUB_PATH_RE.exec(name_branch)).toBe(null);
      });

      test("github path", () => {
        expect(GITHUB_PATH_RE.exec(githubPath)).toMatchObject({
          0: githubPath,
          1: githubPath
        });
      });
      test("github path (version)", () => {
        expect(GITHUB_PATH_RE.exec(githubPath_version)).toMatchObject({
          0: githubPath_version,
          1: githubPath,
          2: version
        });
      });
      test("github path (branch)", () => {
        expect(GITHUB_PATH_RE.exec(githubPath_branch)).toMatchObject({
          0: githubPath_branch,
          1: githubPath,
          3: branch
        });
      });
    });

    describe("NAME_RE", () => {
      test("github uri", () => {
        expect(NAME_RE.exec(githubURI)).toBe(null);
      });
      test("github uri (version)", () => {
        expect(NAME_RE.exec(githubURI_version)).toBe(null);
      });
      test("github uri (branch)", () => {
        expect(NAME_RE.exec(githubURI_branch)).toBe(null);
      });
      test("github zip url (version)", () => {
        expect(NAME_RE.exec(githubZip_version)).toBe(null);
      });
      test("github zip url (branch)", () => {
        expect(NAME_RE.exec(githubZip_branch)).toBe(null);
      });
      test("github path", () => {
        expect(NAME_RE.exec(githubPath)).toBe(null);
      });
      test("github path (version)", () => {
        expect(NAME_RE.exec(githubPath_version)).toBe(null);
      });
      test("github path (branch)", () => {
        expect(NAME_RE.exec(githubPath_branch)).toBe(null);
      });

      test("name", () => {
        expect(NAME_RE.exec(name)).toMatchObject({
          0: name,
          1: name
        });
      });
      test("name (version)", () => {
        expect(NAME_RE.exec(name_version)).toMatchObject({
          0: name_version,
          1: name,
          2: version
        });
      });
      test("name (branch)", () => {
        expect(NAME_RE.exec(name_branch)).toMatchObject({
          0: name_branch,
          1: name,
          3: branch
        });
      });
    });
  });

  describe("parsePackageId", () => {
    test("github uri", () => {
      expect(parsePackageId(githubURI)).toStrictEqual({
        branch: "master",
        githubPath,
        githubURI,
        input: githubURI,
        isVersioned: false,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        version: "latest"
      });
    });
    test("github uri (version)", () => {
      expect(parsePackageId(githubURI_version)).toStrictEqual({
        branch: "v2.3.3",
        githubPath,
        githubURI,
        input: githubURI_version,
        isVersioned: true,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        version
      });
    });
    test("github uri (branch)", () => {
      expect(parsePackageId(githubURI_branch)).toStrictEqual({
        branch,
        githubPath,
        githubURI,
        input: githubURI_branch,
        isVersioned: false,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        version: "latest"
      });
    });

    test("github path", () => {
      expect(parsePackageId(githubPath)).toStrictEqual({
        branch: "master",
        githubPath,
        githubURI,
        input: githubPath,
        isVersioned: false,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        version: "latest"
      });
    });
    test("github path (version)", () => {
      expect(parsePackageId(githubPath_version)).toStrictEqual({
        branch: "v2.3.3",
        githubPath,
        githubURI,
        input: githubPath_version,
        isVersioned: true,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        version
      });
    });

    test("github zip", () => {
      expect(parsePackageId(githubZip_branch)).toStrictEqual({
        branch: branch,
        githubPath,
        githubURI,
        input: githubZip_branch,
        isVersioned: false,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        url: githubZip_branch,
        version: "latest"
      });
    });
    test("github zip (version)", () => {
      expect(parsePackageId(githubZip_version)).toStrictEqual({
        branch: "v2.3.3",
        githubPath,
        githubURI,
        input: githubZip_version,
        isVersioned: true,
        name: githubPath,
        source: `${GITHUB_PREFIX}:${githubPath}`,
        url: githubZip_version,
        version
      });
    });

    test("name", () => {
      expect(parsePackageId(name)).toStrictEqual({
        branch: "master",
        input: name,
        isVersioned: false,
        name,
        source: `${REGISTRY_NAME}:${name}`,
        version: "latest"
      });
    });
    test("name (version)", () => {
      expect(parsePackageId(name_version)).toStrictEqual({
        branch: "v2.3.3",
        input: name_version,
        isVersioned: true,
        name,
        source: `${REGISTRY_NAME}:${name}`,
        version
      });
    });
    test("name (branch)", () => {
      expect(parsePackageId(name_branch)).toStrictEqual({
        branch,
        input: name_branch,
        isVersioned: false,
        name,
        source: `${REGISTRY_NAME}:${name}`,
        version: "latest"
      });
    });

    test("generic zip URL", () => {
      const input = "http://myurl.com/path/to/dist.zip";
      expect(parsePackageId(input)).toStrictEqual({
        input,
        url: input,
        source: `url:${input}`
      });
    });
  });
});
