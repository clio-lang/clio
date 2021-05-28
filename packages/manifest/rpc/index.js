const fs = require("fs");
const path = require("path");

const makeStartScript = (config, target, destination, relativeMain) => {
  const { servers, workers, executor } = config;
  fs.writeFileSync(
    path.join(destination, ".clio", "rpc.json"),
    JSON.stringify({ servers, workers, executor }, null, 2)
  );
  const main =
    target === "web"
      ? '"main.clio"'
      : `require.resolve("../${relativeMain}.js")`;
  fs.writeFileSync(
    path.join(destination, ".clio", "index.js"),
    [
      `const runner = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `runner(${main}, config);`,
    ].join("\n")
  );
  fs.writeFileSync(
    path.join(destination, ".clio", "host.js"),
    [
      `const runner = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `runner(${main}, config, true);`,
    ].join("\n")
  );
};

module.exports.makeStartScript = makeStartScript;
