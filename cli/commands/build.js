const fs = require("fs");
const path = require("path");
const { format } = require("prettier");
const { generator } = require("../../core/generator");

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

const build = async (source, dest) => {
  dest = dest || path.join(source, ".clio", "target", "node");
  const files = getClioFiles(source);
  for (const file of files) {
    const relativeFile = path.relative(source, file);
    const destFile = path.join(dest, `${relativeFile}.js`);
    const destDir = path.dirname(destFile);
    const contents = fs.readFileSync(file, "utf8");
    const compiled = await generator(contents);
    const formatted = format(compiled, { parser: "babel" });
    mkdir(destDir);
    fs.writeFileSync(destFile, formatted, "utf8");
  }
};

const command = "build [source] [destination]";
const desc = "Build a Clio project";
const handler = argv => build(argv.source, argv.destination);
const builder = {
  source: {
    describe: "source directory to read from",
    type: "string",
    default: "."
  },
  destination: {
    describe: "destination directory to write to",
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
