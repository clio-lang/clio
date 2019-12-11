const { get } = require("../../../internals/get/clio-get");

exports.command = "add <url>";
exports.desc = "Add a new dependency";
exports.builder = {
  url: { describe: "source file to analyze", type: "string" }
};
exports.handler = argv => {
  console.log(argv);
  get(argv);
};
