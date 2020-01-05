module.exports = {
  ...require("./config"),
  ...require("./dependencies"),
  ...require("./npm_dependencies"),
  ...require("./packageConfig"),
  ...require("./utils/parse"),
  ...require("./utils/ids")
};
