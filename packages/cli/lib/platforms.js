const fs = require("fs");
const path = require("path");
const Parcel = require("@parcel/core").default;
const { fork, spawnSync } = require("child_process");

const makeHtmlFile = (destination) => {
  const htmlFilePath = path.join(destination, "index.html");
  if (!fs.existsSync(htmlFilePath)) {
    const htmlFileContent = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="X-UA-Compatible" content="ie=edge" />
            <title>Document</title>
          </head>
          <body>
            <script src=".clio/index.js"></script>
          </body>
        </html>
        `;
    fs.writeFileSync(htmlFilePath, htmlFileContent);
  }
};

const patchPkgForWeb = (destination) => {
  const pkgPath = path.join(destination, "package.json");
  const pkgJson = require(pkgPath);
  const newPkg = {
    ...pkgJson,
    alias: {
      async_hooks: "./.clio/empty.js",
      worker_threads: "./.clio/empty.js",
      ws: "clio-rpc/transports/ws/shim.js",
      "main.clio": "./main.clio.js",
      ...pkgJson.alias,
    },
    browserslist: pkgJson.browserslist || ["last 1 Chrome version"],
  };
  fs.writeFileSync(pkgPath, JSON.stringify(newPkg, null, 2));
};

const web = {
  async build(destination, skipBundle) {
    patchPkgForWeb(destination);
    fs.writeFileSync(path.join(destination, ".clio", "empty.js"), "");
    makeHtmlFile(destination);
    if (skipBundle) return;
    const bundler = await setupParcel(destination);
    await bundler.run();
  },
  async run(path) {
    await setupParcel(path, { serveOptions: { port: 1234 } });
  },
  async host() {
    throw new Error(`Platform "web" does not support hosting.`);
  },
};

const node = {
  async build() {},
  async run(destination, ...forkOptions) {
    return fork(path.join(destination, ".clio", "index.js"), ...forkOptions);
  },
  async host(destination, override, ...forkOptions) {
    return override
      ? fork(
          path.join(destination, ".clio", ".host", override, "host.js"),
          ...forkOptions
        )
      : fork(path.join(destination, ".clio", "host.js"), ...forkOptions);
  },
};

// FIXME In the future, this should not be done this way
const defeito = {
  build() {},
  run() {},
};

async function setupParcel(destination, options = {}) {
  // TODO: this should be fixed
  spawnSync("npm", ["i", "-S", "parcel@next"], {
    cwd: destination,
    stdio: "inherit",
  });
  spawnSync("npx", ["parcel", "index.html"], {
    cwd: destination,
    stdio: "inherit",
  });
}

const platforms = {
  web,
  node,
  defeito,
};

function getPlatform(name) {
  const platform = platforms[name];
  if (!platform) return platforms.defeito;
  return platform;
}

exports.getPlatform = getPlatform;
