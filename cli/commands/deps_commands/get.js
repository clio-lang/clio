const packageConfig = require("../../../package/packageConfig");

exports.command = "get";
exports.desc = "Download every dependency listed in Package.json";
exports.builder = {};
exports.handler = () => {
  packageConfig.fetchDependencies();
};
