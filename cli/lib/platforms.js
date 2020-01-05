const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getParsedNpmDependencies } = require("../../package/index");

const web = {
  getPackageInfo(source) {
    const dependencies = getParsedNpmDependencies(source);
    dependencies["clio-internals"] = "latest";

    return {
      dependencies,
      devDependencies: {
        parcel: "^1.12.4"
      },
      scripts: {
        build: "parcel build index.html --out-dir public",
        run: "parcel index.html --out-dir public"
      }
    };
  },
  async build(destination, skipBundle) {
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="X-UA-Compatible" content="ie=edge" />
          <title>Document</title>
        </head>
        <body>
          <script src="src/main.clio.js"></script>
        </body>
      </html>
      `;
    fs.writeFileSync(path.join(destination, "index.html"), htmlContent);

    if (skipBundle) {
      return;
    }

    return new Promise((resolve, reject) => {
      const build = spawn("npm", ["run", "build"], { cwd: destination });
      build.on("close", resolve);
      build.on("error", reject);
    });
  },
  run() {
    throw new Error("Not implemented.");
  }
};

const node = {
  getPackageInfo() {
    const dependencies = getParsedNpmDependencies();
    dependencies["clio-internals"] = "latest";

    return {
      dependencies,
      scripts: {
        run: "node src/main.clio.js"
      }
    };
  },
  build() {},
  run() {
    throw new Error("Not implemented.");
  }
};

const platforms = {
  web,
  node
};

function getPlatform(name) {
  return platforms[name];
}

exports.getPlatform = getPlatform;
