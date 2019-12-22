const fs = require("fs");
const packageConfig = require("../../package/packageConfig");
const { clioImport } = require("../../internals/import");
const { error } = require("../lib/colors");

exports.command = "run [source]";

exports.describe = "Compile and run Clio file";

exports.builder = {
  source: {
    describe: "source file to run",
    type: "string",
    default: (() => {
      // Config file is not available when running tests. This wrapper catches filenotfound exception in these cases
      try {
        return packageConfig.getPackageConfig().main;
      } catch (e) {
        return "";
      }
    })()
  }
};

exports.handler = argv => {
  run(argv.source);
};

async function run(path) {
  try {
    if (!path) {
      throw new Error("The path to the Clio souce file is required.");
    }
    if (!fs.existsSync(path)) {
      throw new Error("The provided Clio source file does not exist.");
    }
    await clioImport(path, true).catch(e => (e.exit ? e.exit() : console.log(e)));
  } catch (e) {
    error(e);
  }
}

exports.run = run;
