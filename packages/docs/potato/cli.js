const fs = require("fs");
const path = require("path");

const Compiler = require("./compiler/index");
const Generator = require("./generator/index");
const matchers = require("./compiler/matchers");

const compile = (file, root) => {
  const code = fs.readFileSync(file).toString();
  const compiler = new Compiler(code, file);
  matchers.forEach((matcher) => compiler.add(matcher));
  const generator = new Generator(compiler);
  compiler.compile();
  const { svelte } = generator.get();
  const destination = path.resolve(
    root,
    "../src/routes",
    file.replace(/^docs\//, "").replace(/\.md$/, "") + ".svelte"
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, svelte);
};

const compileAll = (workdir, root) => {
  const files = fs.readdirSync(workdir);
  const mdfiles = files
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(workdir, file));
  mdfiles.forEach((file) => compile(file, root));
  const directories = files
    .map((dir) => path.join(workdir, dir))
    .filter((file) => fs.statSync(file).isDirectory());
  directories.forEach((dir) => compileAll(dir, root));
};

const cli = () => {
  // workdir is docs root dir
  const workdir = process.argv[2] || ".";
  return compileAll(workdir, workdir);
};

module.exports = cli;
