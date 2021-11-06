import {
  getBuildTarget,
  getDestinationFromConfig,
  getPackageConfig,
} from "clio-manifest";

import { build } from "./build.js";
import { error, trace } from "../lib/colors.js";
import { getPlatform } from "../lib/platforms.js";
import { join } from "path";

export const command = "run [project]";

export const describe = "Compile and run Clio file";

export const builder = {
  project: {
    describe: "Project root directory, where your clio.toml file is.",
    type: "string",
    default: ".",
  },
  silent: {
    describe: "Mutes messages from the command.",
    type: "boolean",
  },
  clean: {
    describe: "Wipe the build directory before build",
    type: "boolean",
  },
  debug: {
    describe: "Show stack traces instead of error messages",
    type: "boolean",
  },
};

export function handler(argv) {
  run(argv, argv._.slice(1));
}

export async function run(argv, args, forkOptions = {}) {
  try {
    const configPath = join(argv.project, "clio.toml");

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
      debug: argv.debug,
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config);
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    return await platform.run(destination, args, forkOptions);
  } catch (e) {
    (argv.debug ? trace : error)(e);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  run,
};
