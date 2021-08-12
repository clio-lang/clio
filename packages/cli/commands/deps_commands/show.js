const path = require("path");
const { error } = require("../../lib/colors");
const {
  getPackageDependencies,
  hasClioDependencies,
  logNoClioDeps,
} = require("clio-manifest");

exports.command = ["$0 [project]", "show [project]"];
exports.desc = "Show a list of dependencies for the project";
exports.builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: path.resolve("."),
  },
};
exports.handler = async (argv) => {
  try {
    const config = path.join(argv.project, "clio.toml");
    if (!hasClioDependencies(config)) {
      logNoClioDeps();
      return;
    }

    const deps = getPackageDependencies(config);
    const formattedDeps = deps
      .map((dep) => `~> ${dep["name"]}: ${dep["version"]}`)
      .join("\n");
    console.log(formattedDeps);
  } catch (e) {
    error(e);
  }
};
