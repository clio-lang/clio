const { getDependencies } = require("../../../internals/deps");

exports.command = "get";
exports.desc = "Download every dependency listed in Package.json";
exports.builder = {};
exports.handler = () => {
  getDependencies();
};
