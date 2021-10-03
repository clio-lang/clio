import { join } from "path";
import { writeFileSync } from "fs";

export const makeStartScript = (config, target, destination) => {
  const { servers, workers, executor } = config;
  writeFileSync(
    join(destination, ".clio", "rpc.json"),
    JSON.stringify({ servers, workers, executor }, null, 2)
  );
  writeFileSync(
    join(destination, ".clio", "index.js"),
    [
      `const path = require("path");`,
      `const run = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `run(path.resolve(__dirname, "../main.clio.js"), config);`,
    ].join("\n")
  );
  writeFileSync(
    join(destination, ".clio", "host.js"),
    [
      `const path = require("path");`,
      `const run = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `run(path.resolve(__dirname, "../main.clio.js"), config, true);`,
    ].join("\n")
  );
};

export default { makeStartScript };
