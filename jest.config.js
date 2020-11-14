module.exports = {
  collectCoverageFrom: [
    "**/*.js",
    "!**/*.clio.js",
    "!coverage/**/*.js",
    "!jest.config.js",
    "!index.js",
    "!browser.js",
    "!common.js",
    "!gulpfile.js",
    "!highlight.js",
    "!jest-puppeteer.config.js",
    "!host/**/*",
    "!tests/**/*",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/jest.config.js",
    "<rootDir>/packages/rpc/test",
  ],
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node", "toml"],
  testEnvironment: "node",
  testTimeout: 30000,
};
