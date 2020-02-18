const { highlight } = require("clio-highlight");
const { error } = require("../lib/colors");

exports.command = "highlight <source>";
exports.desc = "Highlight a Clio file";
exports.builder = {
  source: { describe: "source file to host", type: "string" }
};
exports.handler = function(argv) {
  try {
    const colorized = highlight(argv.source);
    if (colorized) console.log(colorized);
  } catch (err) {
    error(err);
  }
};
