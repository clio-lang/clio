import {
  getBuildTarget,
  getDestinationFromConfig,
  getPackageConfig,
} from "clio-manifest";
import { join, resolve } from "path";

import { build } from "./build.js";
import { error } from "../lib/colors.js";
import { getPlatform } from "../lib/platforms.js";

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
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config);
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    return await platform.run(destination, args, forkOptions);
  } catch (e) {
    error(e);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  run,
};
