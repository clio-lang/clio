import { isSupportedNodeVersion } from "../versionUtils.js";

describe("isSupportedNodeVersion", () => {
  test("14.4 is supported", () => {
    expect(isSupportedNodeVersion("14.4")).toBe(true);
  });

  test("14.6 is supported", () => {
    expect(isSupportedNodeVersion("14.6")).toBe(true);
  });

  test("10.3 is not supported", () => {
    expect(isSupportedNodeVersion("10.3")).toBe(false);
  });
  test("9.6 is not supported", () => {
    expect(isSupportedNodeVersion("9.6")).toBe(false);
  });

  test("9.2 is not supported", () => {
    expect(isSupportedNodeVersion("9.2")).toBe(false);
  });
});
