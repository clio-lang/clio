module.exports = {
  ast: require("./ast"),
  build: require("./build"),
  deps: {
    ...require("./deps"),
    subCommands: require("./deps_commands")
  },
  highlight: require("./highlight"),
  host: require("./host"),
  init: require("./init"),
  // New keyword cannot be used
  _new: require("./new"),
  run: require("./run")
};
