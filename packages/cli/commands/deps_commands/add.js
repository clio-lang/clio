import { error, trace } from "../../lib/colors.js";
import { installDependency } from "clio-manifest";
import { join } from "path";

export const command = "add <source> [project] [options]";
export const describe = "Add a new dependency";
export const builder = {
  source: { describe: "Source to analyze", type: "string" },
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: ".",
  },
  npm: { describe: "Add NPM dependency", type: "boolean" },
  dev: { describe: "Add dev (NPM) dependency", type: "boolean" },
  force: {
    describe: "Force fetching dependencies even if they're already fetched",
    type: "boolean",
  },
  debug: {
    describe: "Show stack traces instead of error messages",
    type: "boolean",
  },
};
export async function handler(argv) {
  try {
    const config = join(argv.project, "clio.toml");
    await installDependency(config, argv.source, argv);
  } catch (e) {
    (argv.debug ? trace : error)(e);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
};
