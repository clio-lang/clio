const { get } = require("../../../package/packageConfig");

exports.command = "add <source>";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "source to analyze", type: "string" }
};
exports.handler = argv => {
  get(argv);
};
