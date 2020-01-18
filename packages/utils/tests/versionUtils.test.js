const versionUtils = require("../lib");

describe("isSupportedNodeVersion", () => {
  test("10.4 is supported", () => {
    expect(versionUtils.isSupportedNodeVersion("10.4")).toBe(true);
  });

  test("10.6 is supported", () => {
    expect(versionUtils.isSupportedNodeVersion("10.6")).toBe(true);
  });

  test("10.3 is not supported", () => {
    expect(versionUtils.isSupportedNodeVersion("10.3")).toBe(false);
  });
  test("9.6 is not supported", () => {
    expect(versionUtils.isSupportedNodeVersion("9.6")).toBe(false);
  });

  test("9.2 is not supported", () => {
    expect(versionUtils.isSupportedNodeVersion("9.2")).toBe(false);
  });
});
