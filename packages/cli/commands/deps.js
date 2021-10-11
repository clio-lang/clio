import { add, get, show } from "./deps_commands/index.js";

export const command = "deps";
export const describe = "Manage clio dependencies";

export function builder(yargs) {
  return yargs.command([add, get, show]).help().alias("h", "help");
}

export default {
  command,
  describe,
  builder,
};
