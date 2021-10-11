import { parsePackageId } from "../utils/parse.js";

const url = "https://github.com/clio-lang/fib";
const tag = "master";
const packageId = `${url}@${tag}`;

describe("pkgr/utils/parse", () => {
  describe("parsePackageId", () => {
    test("Should parse git addr with tag", () => {
      expect(parsePackageId(packageId)).toStrictEqual({
        url,
        tag,
      });
    });
    test("Should throw on faulty git addr", () => {
      expect(() => parsePackageId(url)).toThrowError(
        "Failed to parse the package id"
      );
    });
  });
});
