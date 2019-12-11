const path = require("path");
const clioHost = require("../../host/host");
const { clioImport } = require("../../internals/import");

exports.command = "host <source>";
exports.desc = "Host a Clio file";
exports.builder = {
  source: { describe: "source file to host", type: "string" }
};
exports.handler = function(argv) {
  host(argv.source);
};

function host(source) {
  try {
    const cwd = process.cwd();
    const file = path.join(cwd, source);
    const fileDir = path.dirname(file);

    const _module = clioImport(source);
    return clioHost(_module, fileDir);
  } catch (e) {
    return e.exit ? e.exit() : console.log(e);
  }
}
