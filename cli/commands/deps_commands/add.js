const { get } = require("../../../package/packageConfig");

exports.command = "add <url>";
exports.desc = "Add a new dependency";
exports.builder = {
  url: { describe: "source file to analyze", type: "string" }
};
exports.handler = argv => {
  get(argv);
};
