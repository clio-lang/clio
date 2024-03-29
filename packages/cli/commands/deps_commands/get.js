import { error } from "../../lib/colors.js";
import { fetchDependencies } from "clio-manifest";
import { join } from "path";

export const command = "get [project]";
export const describe =
  "Download every dependency listed in the package config file";
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
    fetchDependencies(config);
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
