const {fetchDependencies} = require("../../../package/index");

exports.command = "get";
exports.desc = "Download every dependency listed in Package.json";
exports.builder = {};
exports.handler = () => fetchDependencies();
