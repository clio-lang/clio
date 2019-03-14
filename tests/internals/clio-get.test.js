const {
  getVersion,
  hasVersion
} = require('../../internals/get/clio-get')

test("Testing private methods", () => {

  const gitHubPackage = "github.com/foo/bar";
  const gitHubPackageVersion = "github.com/foo/bar@1.2.3";

  expect(hasVersion(gitHubPackage)).toBeFalsy();
  expect(hasVersion(gitHubPackageVersion)).toBeTruthy();

})