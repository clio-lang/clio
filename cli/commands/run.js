const fs = require("fs");
const packageConfig = require("../../package/packageConfig");

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
  await require(path).catch(console.log);
}

exports.run = run;
