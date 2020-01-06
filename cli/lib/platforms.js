const fs = require("fs");
const path = require("path");
const Parcel = require("parcel-bundler");

const web = {
  async build(destination, skipBundle) {
    if (skipBundle) return;

    const bundler = await setupParcel(destination);

    await bundler.bundle();
  },
  async run(path) {
    console.log(path);
    const bundler = await setupParcel(path, { watch: true });

    await bundler.serve();
  }
};

const node = {
  async build() {},
  async run(path) {
    await require(path).catch(console.log);
  }
};

async function setupParcel(destination, options = { watch: false }) {
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
            <script src="src/main.clio.js"></script>
          </body>
        </html>
        `;
    fs.writeFileSync(htmlFilePath, htmlFileContent);
  }

  console.log(options);
  return new Parcel(htmlFilePath, {
    outDir: path.join(destination, "dist"),
    outFile: path.join(destination, "dist/index.html"),
    ...options
  });
}

const platforms = {
  web,
  node
};

function getPlatform(name) {
  return platforms[name];
}

exports.getPlatform = getPlatform;
