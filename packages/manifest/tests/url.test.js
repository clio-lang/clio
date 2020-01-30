const { githubZipURL } = require("../utils/url");

describe("url", () => {
  test("githubZipURL", () => {
    expect(
      githubZipURL({
        branch: "master",
        uri: "https://github.com/foo/bar"
      })
    ).toBe("https://github.com/foo/bar/archive/master.zip");
  });
});

// npm test -- package/tests/url
