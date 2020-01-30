const { fetchDependencies } = require("../../../manifest/index");

exports.command = "get";
exports.desc = "Download every dependency listed in the package config file";
exports.builder = {};
exports.handler = () => fetchDependencies();
