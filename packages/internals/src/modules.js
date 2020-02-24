const moduleName = path =>
  path
    .split("/")
    .pop()
    .replace(/(\.clio|\.js)$/, "");

module.exports.moduleName = moduleName;
