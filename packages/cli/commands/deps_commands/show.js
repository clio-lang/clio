import {
  getPackageDependencies,
  hasClioDependencies,
  logNoClioDeps,
} from "clio-manifest";
import { join, resolve } from "path";

import { error } from "../../lib/colors.js";

export const command = ["$0 [project]", "show [project]"];
export const describe = "Show a list of dependencies for the project";
export const builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: ".",
  },
};
export async function handler(argv) {
  try {
    const config = join(argv.project, "clio.toml");
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
}

export default {
  command,
  describe,
  builder,
  handler,
};
