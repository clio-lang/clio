const fs = require("fs");
const { spawnSync } = require("child_process");
const path = require("path");
const { format } = require("prettier");
const { generator } = require("../../core/generator");
const { error } = require("../lib/colors");
const packageConfig = require("../../package/packageConfig");

const flatten = arr => arr.reduce((acc, val) => acc.concat(val), []);

const isDir = dir => fs.lstatSync(dir).isDirectory();
const readDir = dir => fs.readdirSync(dir);
const walkDir = dir => readDir(dir).map(f => walk(path.join(dir, f)));
const walk = dir => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

const isClioFile = file => file.endsWith(".clio");
const getClioFiles = dir => walk(dir).filter(isClioFile);

const mkdir = directory => {
  const { root, dir, base } = path.parse(directory);
  const parts = [...dir.split(path.sep), base];
  return parts.reduce((parent, subdir) => {
    parent = path.join(parent, subdir);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent);
    return parent;
  }, root);
};

function getDestinationFromConfig(source, target) {
  const config = packageConfig.getPackageConfig();
  const buildConfig = config.build;

  if (!buildConfig) {
    throw new Error(
      'No build configuration has been found. It is a "[build]" section on you "clio.toml" file.'
    );
  }

  const buildTarget =
    target ||
    (buildConfig.target in config.target
      ? config.target[buildConfig.target].target
      : buildConfig.target);

  const buildDirectory = buildConfig.directory;

  if (!buildDirectory) {
    throw new Error(
      'The build directory is missing on your "clio.toml".\n\nExample:\n\n[build]\ndirectory = "build"\n'
    );
  }

  if (!buildTarget) {
    throw new Error(
      '"target" field is missing in your clio.toml file. You can override the target with the "--target" option.'
    );
  }

  return path.join(source, `${buildDirectory}/${buildTarget}`);
}

const build = async (source, dest, target) => {
  try {
    const destination = dest || getDestinationFromConfig(source, target);
    const files = getClioFiles(source);
    for (const file of files) {
      const relativeFile = path.relative(source, file);
      const destFile = path.join(destination, `${relativeFile}.js`);
      const destDir = path.dirname(destFile);
      const contents = fs.readFileSync(file, "utf8");
      const compiled = await generator(contents);
      const formatted = format(compiled, { parser: "babel" });
      mkdir(destDir);
      fs.writeFileSync(destFile, formatted, "utf8");
    }

    const packageJsonPath = path.join(destination, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(
          {
            dependencies: { "clio-internals": "0.1.0" },
            scripts: {
              build: "parcel build index.html --out-dir public",
              run: "parcel index.html --out-dir public"
            }
          },
          null,
          2
        )
      );
    }

    process.chdir(destination);
    spawnSync("npm", ["install"]);
  } catch (e) {
    error(e);
  }
};

const command = "build [target] [source] [destination]";
const desc = "Build a Clio project";
const handler = argv => build(argv.source, argv.destination, argv.target);
const builder = {
  source: {
    describe: "source directory to read from",
    type: "string",
    default: "."
  },
  destination: {
    describe: "destination directory to write to",
    type: "string"
  },
  target: {
    describe: "An override for the default project target.",
    type: "string"
  }
};

module.exports = {
  build,
  command,
  desc,
  builder,
  handler
};
