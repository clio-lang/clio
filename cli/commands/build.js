const fs = require("fs");
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
  const tomlPath = path.join(source, "clio.toml");
  if (!fs.existsSync(tomlPath)) {
    throw new Error("clio.toml was not found on the specified directory.");
  }

  const buildConfig = packageConfig.getPackageConfig().build;

  if (!buildConfig) {
    throw new Error(
      'No build configuration has been found. It is a "[build]" section on you "clio.toml" file.'
    );
  }

  const buildDirectory = buildConfig.directory;

  if (!buildDirectory) {
    throw new Error(
      'The build directory is missing on your "clio.toml".\n\nExample:\n\n[build]\ndirectory = "build"\n'
    );
  }

  const buildTarget = target || buildConfig.target;

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
  } catch (e) {
    error(e);
  }
};

const command = "build [source] [destination]";
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
