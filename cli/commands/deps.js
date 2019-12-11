const { showDependencies } = require("../../internals/deps");

exports.command = "deps";
exports.desc = "Manage clio dependencies";
exports.builder = yargs => {
  return yargs.commandDir("deps_commands");
};
exports.handler = () => {
  showDependencies();
};
