function removeProps(obj, keys) {
  if (obj instanceof Array) {
    obj.forEach(function(item) {
      removeProps(item, keys);
    });
  } else if (typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      if (keys.indexOf(key) !== -1) {
        delete obj[key];
      } else {
        removeProps(obj[key], keys);
      }
    });
  }
}

function printAst(ast) {
  const treeify = require("treeify");
  removeProps(ast, "index");
  console.log(treeify.asTree(ast, true));
  //console.dir(x, { depth: null, colors: true });
}

module.exports = printAst;
