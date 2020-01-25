module.exports = {
  collectCoverageFrom: [
    "**/*.js",
    "!**/*.clio.js",
    "!coverage/**/*.js",
    "!index.js",
    "!browser.js",
    "!common.js",
    "!gulpfile.js",
    "!highlight.js",
    "!jest-puppeteer.config.js",
    "!host/**/*",
    "!tests/**/*"
  ],
  moduleFileExtensions: ["js", "json", "jsx", "ts", "tsx", "node", "toml"],
  testEnvironment: "node"
};
