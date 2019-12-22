const packageConfig = require("../../package/packageConfig");
//const { clioImport } = require("../../internals/import");

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
        console.log(
          "cliopkg.toml not found. Is it missing, or are you running tests?"
        );
        return "";
      }
    })()
  }
};

exports.handler = argv => {
  run(argv.source);
};

async function run(path) {
  await clioImport(path, true).catch(e => (e.exit ? e.exit() : console.log(e)));
}

exports.run = run;
