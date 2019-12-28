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
  new: require("./new"),
  run: require("./run")
};
