import { join } from "path";
import { writeFileSync } from "fs";

export const makeStartScript = (config, target, destination) => {
  const { servers, workers, executor } = config;
  const rpc = JSON.stringify({ servers, workers, executor }, null, 2);
  writeFileSync(join(destination, ".clio", "rpc.json"), rpc);
  writeFileSync(
    join(destination, ".clio", "index.js"),
    [
      `import { resolve, dirname } from "path";`,
      `import { fileURLToPath } from "url";`,
      `import run from "clio-run/src/runners/auto.js";`,
      `const __dirname = dirname(fileURLToPath(import.meta.url));`,
      `const config = ${rpc};`,
      `run(resolve(__dirname, "../main.clio.js"), config);`,
    ].join("\n")
  );
  writeFileSync(
    join(destination, ".clio", "host.js"),
    [
      `import { resolve, dirname } from "path";`,
      `import { fileURLToPath } from "url";`,
      `import run from "clio-run/src/runners/auto.js";`,
      `const __dirname = dirname(fileURLToPath(import.meta.url));`,
      `const config = ${rpc};`,
      `run(resolve(__dirname, "../main.clio.js"), config, true);`,
    ].join("\n")
  );
};

export default { makeStartScript };
