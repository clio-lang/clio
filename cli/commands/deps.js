const {
  getPackageDependencies,
  hasClioDependencies,
  logNoClioDeps
} = require("../../package/index");

exports.command = "deps";
exports.desc = "Manage clio dependencies";
exports.builder = yargs => {
  return yargs
    .commandDir("deps_commands")
    .help()
    .alias("h", "help");
};
exports.handler = () => {
  showDependencies();
};

/**
 * @method showDependencies
 * @returns {void}
 * @description Prints to the stdout the list of
 *              dependencies listed in package.json
 */

const showDependencies = () => {
  if (!hasClioDependencies()) {
    logNoClioDeps();
    return;
  }

  const deps = getPackageDependencies();
  const formattedDeps = deps
    .map(dep => `~> ${dep["name"]}: ${dep["version"]}`)
    .join("\n");
  console.log(formattedDeps);
};
exports.showDependencies = showDependencies;
