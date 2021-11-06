import { error, trace } from "../lib/colors.js";
import { highlight } from "clio-highlight";

export const command = "highlight <source>";
export const describe = "Highlight a Clio file";
export const builder = {
  source: {
    describe: "source file to host",
    type: "string"
  },
  debug: {
    describe: "Show stack traces instead of error messages",
    type: "boolean"
  }
};
export function handler(argv) {
  const { debug } = argv
  const errorOrTrace = debug ? trace : error;

  try {
    const colorized = highlight(argv.source);
    if (colorized) console.log(colorized);
  } catch (err) {
    errorOrTrace(err);
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
