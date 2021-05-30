const fs = require("fs");
const path = require("path");

const makeStartScript = (config, target, destination) => {
  const { servers, workers, executor } = config;
  fs.writeFileSync(
    path.join(destination, ".clio", "rpc.json"),
    JSON.stringify({ servers, workers, executor }, null, 2)
  );
  fs.writeFileSync(
    path.join(destination, ".clio", "index.js"),
    [
      `const path = require("path");`,
      `const run = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `run(path.resolve(__dirname, "../main.clio.js"), config);`,
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(destination, ".clio", "host.js"),
    [
      `const path = require("path");`,
      `const run = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `run(path.resolve(__dirname, "../main.clio.js"), config, true);`,
    ].join("\n")
  );
};

module.exports.makeStartScript = makeStartScript;
