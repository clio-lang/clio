import {
  getBuildTarget,
  getDestinationFromConfig,
  getPackageConfig,
} from "clio-manifest";

import { build } from "./build.js";
import { error } from "../lib/colors.js";
import { getPlatform } from "../lib/platforms.js";
import { join } from "path";

export const command = "host [project]";

export const describe = "Compile and host Clio file";

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
  host(argv, argv._.slice(1));
}

export async function host(argv, args) {
  try {
    const configPath = join(argv.project, "clio.toml");

    await build(configPath, {
      skipBundle: true,
      silent: argv.silent,
      clean: argv.clean,
    });

    const config = getPackageConfig(configPath);
    const target = getBuildTarget(configPath, config); // No target override
    const destination = getDestinationFromConfig(configPath, config);
    const platform = getPlatform(target);

    return await platform.host(destination, args);
  } catch (e) {
    error(e);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  host,
};
