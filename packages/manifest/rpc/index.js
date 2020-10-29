const fs = require("fs");
const path = require("path");

const makeStartScript = (config, target, destination) => {
  const { transports, workers, main, executor } = config;
  fs.writeFileSync(
    path.join(destination, "rpc.json"),
    JSON.stringify({ transports, workers, executor }, null, 2)
  );
  fs.writeFileSync(
    path.join(destination, "start.js"),
    `const server = require("clio-run/servers/wt.js");\n` +
      `const config = require("./rpc.json");\n` +
      `server(${main}.js)`
  );
};

module.exports.makeStartScript = makeStartScript;
