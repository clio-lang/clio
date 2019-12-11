const highlight = require("../highlight");
const fs = require("fs");

exports.command = "highlight <source>";
exports.desc = "Highlight a Clio file";
exports.builder = {
  source: { describe: "source file to host", type: "string" }
};
exports.handler = function(argv) {
  fs.readFile(argv.source, "utf8", (err, contents) => {
    if (err) console.trace(err);
    console.log(highlight(contents));
  });
};
