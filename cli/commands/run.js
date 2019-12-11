const packageConfig = require("../../package/packageConfig");
const run = require("../run");

exports.command = "run [source]";

exports.describe = "Compile and run Clio file";

exports.builder = {
  source: {
    describe: "source file to run",
    type: "string",
    default: packageConfig.getPackageConfig().main
  }
};

exports.handler = argv => {
  if (argv.source) {
    run(argv.source);
  }
};
