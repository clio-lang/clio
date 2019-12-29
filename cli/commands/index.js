module.exports = {
  ast: require("./ast").printAst,
  build: require("./build").build,
  deps: {
    ...require("./deps").showDependencies,
    add: require("./deps_commands").add,
    get: require("./deps_commands").get
  },
  highlight: require("./highlight").highlight,
  host: require("./host").host,
  init: require("./init").initPackage,
  // New keyword cannot be used
  _new: require("./new").createPackage,
  run: require("./run").run
};
