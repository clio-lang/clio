import { error } from "../lib/colors.js";
import { highlight } from "clio-highlight";

export const command = "highlight <source>";
export const describe = "Highlight a Clio file";
export const builder = {
  source: { describe: "source file to host", type: "string" },
};
export function handler(argv) {
  try {
    const colorized = highlight(argv.source);
    if (colorized) console.log(colorized);
  } catch (err) {
    error(err);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  highlight,
};

export { highlight } from "clio-highlight";
