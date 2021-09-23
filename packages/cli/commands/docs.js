const path = require("path");
const fs = require("fs");
const { Toggle } = require("enquirer");
const { AutoComplete } = require("../lib/prompt");
const { parse, tokenize } = require("clio-core");
const { parsingError } = require("clio-core/errors");
const chalk = require("chalk");
const {
  MODULES_PATH,
  getPackageConfig,
  getSourceFromConfig,
  getDestinationFromConfig,
} = require("clio-manifest");

exports.command = "docs [project]";
exports.describe = "Show documentation for a Clio module";

exports.builder = {
  project: {
    describe: "Project root directory",
    type: "string",
    default: ".",
  },
};

exports.handler = (argv) => {
  entry(argv.project);
};

function onSelect(root, prompt, configPath) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? docs(path.dirname(root), configPath)
      : docs(path.join(root, answer), configPath);
  };
}

function onFnSelect(root, fnMap, prompt, configPath) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? docs(path.dirname(root))
      : docsFn(root, answer, fnMap[answer], configPath);
  };
}

function selectFn(root, fns, configPath) {
  const fnMap = Object.fromEntries(
    fns.map((fn) => [
      fn.name,
      fn.doc || `No documentation available for ${fn.name}`,
    ])
  );
  const prompt = new AutoComplete({
    name: "function",
    message: "Select a function",
    choices: ["..", ...Object.keys(fnMap)],
  });
  prompt
    .run()
    .then(onFnSelect(root, fnMap, prompt, configPath))
    .catch(console.error);
}

function selectFile(root, choices, configPath) {
  const prompt = new AutoComplete({
    name: "file",
    message: "Select a file or a directory",
    choices: ["..", ...choices],
  });
  prompt.run().then(onSelect(root, prompt, configPath)).catch(console.error);
}

// TODO: move to clio-highlight
function colorize(docs) {
  // TODO: imrpove highlighting
  return docs
    .replace(/@[^\s]+/g, (matched) => chalk.blue(matched))
    .replace(
      /({[^}]+})(\s+)([^\s]+)/g,
      (_, type, spaces, name) => chalk.red(type) + spaces + chalk.magenta(name)
    );
}

function docsFn(root, name, docs, configPath) {
  const docsstr = docs.replace(/^\+-\s+/, "").replace(/\s+-\+$/, "");
  console.log(
    [
      chalk.yellow(`Showing docs for ${root}:${name}\n`),
      colorize(docsstr),
      "",
    ].join("\n")
  );
  const prompt = new Toggle({
    name: "docs",
    message: "Exit?",
    enabled: "Yes",
    disabled: "..",
    initial: true,
  });
  prompt
    .run()
    .then((answer) => {
      prompt.clear();
      if (!answer) return docsFile(root, configPath);
    })
    .catch(console.error);
}

async function docsFile(file, configPath) {
  const source = fs.readFileSync(file, { encoding: "utf-8" });
  const config = getPackageConfig(configPath);
  const sourceDir = getSourceFromConfig(configPath, config);
  const destination = getDestinationFromConfig(configPath, config);
  const modulesDir = path.join(sourceDir, MODULES_PATH);
  const modulesDestDir = path.join(destination, MODULES_PATH);
  const rpcPrefix = `${config.title}@${config.version}`;
  const relativeFile = path.relative(sourceDir, file);
  const destFileClio = path.join(destination, relativeFile);
  const destFile = `${destFileClio}.js`;

  const tokens = tokenize(source, {
    file,
    root: path.dirname(configPath),
    config,
    sourceDir,
    modulesDir,
    modulesDestDir,
    rpcPrefix,
    destFile,
  });
  const result = parse(tokens, source, file);
  if (result.first.item.type == "clio") {
    /* istanbul ignore next */
    const fns = result.first.item.content
      .map((item) => item.fn)
      .filter(Boolean);
    return selectFn(file, fns, configPath);
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
}

function docsDirectory(projectPath, configPath) {
  const choices = fs
    .readdirSync(projectPath)
    .filter((dir) => !dir.startsWith("."))
    .filter((name) => {
      const abs = path.join(projectPath, name);
      return isDirectory(abs) || isClioFile(name);
    });
  selectFile(projectPath, choices, configPath);
}

function isDirectory(dir) {
  return fs.lstatSync(dir).isDirectory();
}

function isClioFile(file) {
  return file.endsWith(".clio");
}

function docs(path, configPath) {
  return isDirectory(path)
    ? docsDirectory(path, configPath)
    : docsFile(path, configPath);
}

function entry(projectPath) {
  const configPath = path.join(projectPath, "clio.toml");
  return docs(projectPath, configPath);
}

exports.docs = docs;
