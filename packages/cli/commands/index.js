module.exports = {
  build: require("./build").build,
  run: require("./run").run,
  host: require("./host").host,
  _new: require("./new").createPackage, // Can't use "new" here
  deps: {
    ...require("./deps").showDependencies,
    add: require("./deps_commands").add,
    get: require("./deps_commands").get,
  },
  docs: require("./docs").docs,
  highlight: require("clio-highlight").highlight,
};
