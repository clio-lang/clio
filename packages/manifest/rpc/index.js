const fs = require("fs");
const path = require("path");

const makeStartScript = (config, target, destination) => {
  // FIXME: We need separate config entries for main and src
  const main = config.main.replace(/^src\//, "");
  const RPCConf = config.RPC;
  fs.writeFileSync(
    path.join(destination, "rpc.json"),
    JSON.stringify(RPCConf, null, 2)
  );
  fs.writeFileSync(
    path.join(destination, "start.js"),
    `const { rpc } = require("clio-internals");\n` +
      `const config = require("./rpc.json");\n` +
      `const scope = require("./${main}.js");\n` +
      `rpc.init(scope, config);`
  );
};

module.exports.makeStartScript = makeStartScript;
