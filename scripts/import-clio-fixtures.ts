/** Import trusted upstream test declarations without running the old compiler. */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const repository = process.argv[2];
if (!repository)
  throw new Error(
    "Usage: bun scripts/import-clio-fixtures.ts /path/to/clio [revision]",
  );
const revision = process.argv[3] ?? "75c7c09e962ef15506ff9bc7cf856aad727436c5";
const git = (...args: string[]) =>
  execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" });
const commit = git("rev-parse", `${revision}^{commit}`).trim();
const read = (path: string) => git("show", `${commit}:${path}`);
const path = "packages/core/tests/clio.test.js";
const source = read(path);
interface Fixture {
  name: string;
  source: string;
  expectedJavaScript?: string;
  expectedError?: string;
  file: string;
  wrapped?: boolean;
}
const accepted: Fixture[] = [];
const rejected: Fixture[] = [];
const deferred: { name: string; stage: string }[] = [];
const testStr = (
  name: string,
  source: string,
  expectedJavaScript: string,
  file = "<mem>",
  wrapped = true,
) => {
  accepted.push({ name, source, expectedJavaScript, file, wrapped });
};
const declarations = source.indexOf('testStr("Booleans"');
if (declarations < 0)
  throw new Error("Cannot find the expected upstream test declarations");
runInNewContext(
  source.slice(declarations),
  {
    testStr,
    testFile(name: string, expected: string, wrapped = true) {
      testStr(
        `${name}.clio`,
        read(`packages/core/tests/clio/${name}.clio`),
        expected,
        `${name}.clio`,
        wrapped,
      );
    },
    shouldThrow(
      name: string,
      source: string,
      expectedError: string,
      file = "<mem>",
    ) {
      rejected.push({ name, source, expectedError, file });
    },
    projectShouldThrow(name: string) {
      deferred.push({ name, stage: "module-resolution" });
    },
    test(name: string) {
      deferred.push({ name, stage: "filesystem-cache" });
    },
  },
  { timeout: 1000 },
);
await mkdir("tests/fixtures/clio", { recursive: true });
await writeFile(
  "tests/fixtures/clio/corpus.json",
  JSON.stringify(
    {
      upstream: "https://github.com/clio-lang/clio",
      commit,
      path,
      accepted,
      rejected,
      deferred,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Imported ${accepted.length} accepted, ${rejected.length} rejected, ${deferred.length} deferred fixtures from ${commit}.`,
);

// Keep executable helper references beside the compiler-output corpus.
await writeFile(
  "tests/fixtures/clio/runtime.json",
  JSON.stringify(
    {
      commit,
      sources: Object.fromEntries(
        ["range", "slice", "format", "decorators", "types"].map((name) => [
          name,
          read(`packages/internals/src/${name}.js`),
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
