const fs = require("fs");
const path = require("path");

const makeStartScript = (config, target, destination, relativeMain) => {
  const { transports, workers, executor } = config;
  fs.writeFileSync(
    path.join(destination, "rpc.json"),
    JSON.stringify({ transports, workers, executor }, null, 2)
  );
  fs.writeFileSync(
    path.join(destination, "start.js"),
    [
      `const runner = require("clio-run/src/runners/wt.js");`,
      `const config = require("./rpc.json");`,
      `require("./${relativeMain}.js");`,
      `runner(require.resolve("./${relativeMain}.js"))`,
    ].join("\n")
  );
};

module.exports.makeStartScript = makeStartScript;
