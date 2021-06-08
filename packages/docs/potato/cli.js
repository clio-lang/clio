const fs = require("fs");
const path = require("path");

const Compiler = require("./compiler/index");
const Generator = require("./generator/index");
const matchers = require("./compiler/matchers");

const isDir = (file) => fs.statSync(file).isDirectory();

const getVariant = (route, variants) => {
  return variants[route.split("/").shift()];
};

const setMeta = (filename, sections, title, variants) => {
  const route = filename.endsWith("index.svelte")
    ? filename.slice(0, -13)
    : filename.slice(0, -7);
  const { index, routes, urls } = getVariant(route, variants);
  index[route] = { sections };
  const directory = filename.endsWith("index.svelte")
    ? route
    : path.dirname(route);
  routes[directory] = routes[directory] || [];
  routes[directory].push({ filename: "./routes/" + filename, title });
  urls[route] = "./routes/" + filename;
};

const compile = (file, root, variants) => {
  const code = fs.readFileSync(file).toString();
  const compiler = new Compiler(code, file);
  matchers.forEach((matcher) => compiler.add(matcher));
  const generator = new Generator(compiler);
  compiler.compile();
  const { svelte, sections, title } = generator.get();
  const filename = file.replace(/^docs\//, "").replace(/\.md$/, "") + ".svelte";
  setMeta(filename, sections, title, variants);
  const destination = path.resolve(root, "../src/routes", filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, svelte);
};

const compileAll = (workdir, root, variants) => {
  const files = fs.readdirSync(workdir);
  const mdfiles = files
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(workdir, file));
  mdfiles.forEach((file) => compile(file, root, variants));
  const directories = files.map((dir) => path.join(workdir, dir)).filter(isDir);
  directories.forEach((dir) => compileAll(dir, root, variants));
};

const makeVariants = (workdir) => {
  const variants = fs
    .readdirSync(workdir)
    .map((subdir) => path.join(workdir, subdir))
    .filter(isDir)
    .map((variant) => variant.replace(/^docs\//, ""));
  fs.writeFileSync(
    path.resolve(workdir, "../src", "variants.json"),
    JSON.stringify(variants, null, 2)
  );
  return Object.fromEntries(
    variants.map((variant) => [variant, { routes: {}, index: {}, urls: {} }])
  );
};

const writeVariants = (workdir, variants) => {
  for (const variant in variants) {
    const destdir = path.resolve(workdir, "../src/meta");
    if (!fs.existsSync(destdir)) fs.mkdirSync(destdir, { recursive: true });
    fs.writeFileSync(
      path.join(destdir, variant + ".json"),
      JSON.stringify(variants[variant], null, 2)
    );
  }
};

const writeImports = (workdir, variants) => {
  const imports = [];
  for (const variant in variants) {
    imports.push("./meta" + "/" + variant + ".json");
    const roots = Object.values(variants[variant].routes);
    for (const dir of roots) {
      for (const route of dir) {
        imports.push(route.filename);
      }
    }
  }
  const code = [
    "export default function dynamicImport(path) {",
    "  switch (path) {",
    ...imports.map(
      (path) => `    case "${path}":\n      return import("${path}");`
    ),
    "    default:",
    "      break;",
    "  }",
    "};\n",
  ].join("\n");
  const dest = path.resolve(workdir, "../src/imports.js");
  fs.writeFileSync(dest, code);
};

const cli = () => {
  // workdir is docs root dir
  const workdir = process.argv[2] || ".";
  const variants = makeVariants(workdir);
  compileAll(workdir, workdir, variants);
  writeVariants(workdir, variants);
  writeImports(workdir, variants);
};

module.exports = cli;
