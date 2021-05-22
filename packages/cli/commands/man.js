const path = require("path");
const fs = require("fs");
const { Select, Toggle } = require("enquirer");
const { parse, tokenize } = require("clio-core");
const { parsingError } = require("clio-core/errors");
const chalk = require("chalk");

exports.command = "man [source]";
exports.describe = "Show manuals for a Clio module";

exports.builder = {
  source: {
    describe: "source file or directory of the manual",
    type: "string",
    default: ".",
  },
};

exports.handler = (argv) => {
  man(argv.source);
};

function onSelect(root, prompt) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? man(path.dirname(root))
      : man(path.join(root, answer));
  };
}

function onFnSelect(root, fnMap, prompt) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? man(path.dirname(root))
      : manFn(root, answer, fnMap[answer]);
  };
}

function selectFn(root, fns) {
  const fnMap = Object.fromEntries(
    fns.map((fn) => [
      fn.name,
      fn.man?.value || `No manual available for ${fn.name}`,
    ])
  );
  const prompt = new Select({
    name: "function",
    message: "Select a function",
    choices: ["..", ...Object.keys(fnMap)],
  });
  prompt.run().then(onFnSelect(root, fnMap, prompt)).catch(console.error);
}

function selectFile(root, choices) {
  const prompt = new Select({
    name: "file",
    message: "Select a file or a directory",
    choices: ["..", ...choices],
  });
  prompt.run().then(onSelect(root, prompt)).catch(console.error);
}

// TODO: move to clio-highlight
function colorize(man) {
  // TODO: imrpove highlighting
  return man
    .replace(/@[^\s]+/g, (matched) => chalk.blue(matched))
    .replace(
      /({[^}]+})(\s+)([^\s]+)/g,
      (_, type, spaces, name) => chalk.red(type) + spaces + chalk.magenta(name)
    );
}

function manFn(root, name, man) {
  const manstr = man.replace(/^\+-\s+/, "").replace(/\s+-\+$/, "");
  console.log(
    [
      chalk.yellow(`Showing man for ${root}:${name}\n`),
      colorize(manstr),
      "",
    ].join("\n")
  );
  const prompt = new Toggle({
    name: "man",
    message: "Exit?",
    enabled: "Yes",
    disabled: "..",
    initial: true,
  });
  prompt
    .run()
    .then((answer) => {
      prompt.clear();
      if (!answer) return manFile(root);
    })
    .catch(console.error);
}

async function manFile(filename) {
  const source = fs.readFileSync(filename, { encoding: "utf-8" });
  const tokens = tokenize(source, filename);
  const result = parse(tokens);
  if (result.first.item.type == "clio") {
    /* istanbul ignore next */
    const fns = result.first.item.content
      .map((item) => item.fn)
      .filter(Boolean);
    return selectFn(filename, fns);
  } else {
    /* istanbul ignore next */
    throw parsingError(source, file, result);
  }
}

function manDirectory(projectPath) {
  const choices = fs
    .readdirSync(projectPath)
    .filter((dir) => !dir.startsWith("."))
    .filter((name) => {
      const abs = path.join(projectPath, name);
      return isDirectory(abs) || isClioFile(name);
    });
  selectFile(projectPath, choices);
}

function isDirectory(dir) {
  return fs.lstatSync(dir).isDirectory();
}

function isClioFile(file) {
  return file.endsWith(".clio");
}

function man(projectPath) {
  return isDirectory(projectPath)
    ? manDirectory(projectPath)
    : manFile(projectPath);
}

exports.man = man;
