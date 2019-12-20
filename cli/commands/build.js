const fs = require("fs");

const path = require("path");
const { format } = require("prettier");
const { generator } = require("../../core/generator");

const flatten = arr => arr.reduce((acc, val) => acc.concat(val), []);
const mkdirp = dir => dir.split('/').reduce((path, currentDir) => {
  if (!path && !currentDir) return '';
  const newPath = `${path}/${currentDir}`;
  if (newPath && !fs.existsSync(newPath)) {
    fs.mkdirSync(newPath);
  }
  return newPath;
}, '')


const isDir = dir => fs.lstatSync(dir).isDirectory();
const readDir = dir => fs.readdirSync(dir);
const walkDir = dir => readDir(dir).map(f => walk(path.join(dir, f)));
const walk = dir => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

const isClioFile = file => file.endsWith(".clio");
const getClioFiles = dir => walk(dir).filter(isClioFile);

const mkdir = dir =>
  dir.split(path.sep).reduce((parent, subdir) => {
    parent = path.join(parent, subdir);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent);
    return parent;
  }, "");

const compile = async (source, dest) => {
  dest = dest || path.join(source, ".clio", "target", "node");
  if (!fs.existsSync(dest)) {
    mkdirp(dest);
  }
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
const handler = argv => compile(argv.source, argv.destination);
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
  compile,
  command,
  desc,
  builder,
  handler
};
