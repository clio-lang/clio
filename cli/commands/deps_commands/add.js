const { get } = require("../../../internals/get/clio-get");

exports.command = "add <source>";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "source to analyze", type: "string" }
};
exports.handler = argv => {
  console.log(argv);
  get(argv);
};
