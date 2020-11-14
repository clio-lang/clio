module.exports = {
  build: require("./build").build,
  deps: {
    ...require("./deps").showDependencies,
    add: require("./deps_commands").add,
    get: require("./deps_commands").get,
  },
  highlight: require("clio-highlight").highlight,
  _new: require("./new").createPackage, // Can't use "new" here
  run: require("./run").run,
  host: require("./host").host,
};
