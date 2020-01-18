const path = require("path");

exports.command = "host <source>";
exports.desc = "Host a Clio file";
exports.builder = {
  source: { describe: "source file to host", type: "string" }
};
exports.handler = function(argv) {
  host(argv.source);
};

exports.host = async source => {
  try {
    const cwd = process.cwd();
    const file = path.join(cwd, source);
    const fileDir = path.dirname(file);

    const _module = await require(source);
    if (!_module.host) {
      throw new Error("No host context found. Are you running a host file?");
    }
    console.log("Host is awaiting re-implementation");
  } catch (e) {
    console.log(e);
  }
};
