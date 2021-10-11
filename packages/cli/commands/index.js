import { add, get, show } from "./deps_commands/index";

export { build } from "./build.js";
export { run } from "./run.js";
export { host } from "./host.js";
export { createPackage as _new } from "./new.js";
export { docs } from "./docs.js";
export { highlight } from "clio-highlight";

export const deps = {
  show,
  add,
  get,
};
