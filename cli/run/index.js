const { clioImport } = require("../../internals/import");
function run(path) {
  clioImport(path, true).catch(e => (e.exit ? e.exit() : console.log(e)));
}
module.exports = run;
