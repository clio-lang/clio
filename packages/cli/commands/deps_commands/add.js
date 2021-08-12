const path = require("path");
const fs = require("fs");

const { installDependency } = require("clio-manifest");
const { error } = require("../../lib/colors");
const { configPrompt } = require("../../lib/config");

exports.command = "add <source> [project] [options]";
exports.desc = "Add a new dependency";
exports.builder = {
  source: { describe: "Source to analyze", type: "string" },
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: path.resolve("."),
  },
  npm: { describe: "Add NPM dependency", type: "boolean" },
  dev: { describe: "Add dev (NPM) dependency", type: "boolean" },
  force: {
    describe: "Force fetching dependencies even if they're already fetched",
    type: "boolean",
  },
};
exports.handler = async (argv) => {
  try {
    const config = path.join(argv.project, "clio.toml");
    await installDependency(config, argv.source, argv);
  } catch (e) {
    error(e);
  }
};
