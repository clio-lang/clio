exports.command = "deps";
exports.desc = "Manage clio dependencies";
exports.builder = (yargs) => {
  return yargs.commandDir("deps_commands").help().alias("h", "help");
};
