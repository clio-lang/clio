const { installDependency } = require("clio-manifest");

exports.command = "add <source>";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "source to analyze", type: "string" }
};
exports.handler = argv => {
  installDependency(argv.source);
};
