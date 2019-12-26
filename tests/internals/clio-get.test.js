const { getVersion, hasVersion } = require("../../package/packageConfig");

test("Testing private methods", () => {
  const gitHubPackage = "github.com/foo/bar";
  const gitHubPackageVersion = "github.com/foo/bar@1.2.3";

  expect(hasVersion(gitHubPackage)).toBeFalsy();
  expect(hasVersion(gitHubPackageVersion)).toBeTruthy();
  expect(getVersion(gitHubPackageVersion)).toBe("@1.2.3");
});
