const { installDependency } = require("clio-manifest");

exports.command = "add <source> [options]";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "source to analyze", type: "string" },
  npm: { describe: "Add NPM dependency", type: "boolean" },
  dev: { describe: "Add dev (NPM) dependency", type: "boolean" },
};
exports.handler = (argv) => {
  installDependency(argv.source, argv);
};
