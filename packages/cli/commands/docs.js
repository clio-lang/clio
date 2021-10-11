import {
  MODULES_PATH,
  getDestinationFromConfig,
  getPackageConfig,
  getSourceFromConfig,
} from "clio-manifest";
import { dirname, join, relative } from "path";
import { lstatSync, readdirSync } from "fs";

import { AutoComplete } from "../lib/prompt.js";
import chalk from "chalk";
import { compileFile } from "clio-core";
import enquirer from "enquirer";

const { blue, magenta, red, yellow } = chalk;

export const command = "docs [project]";
export const describe = "Show documentation for a Clio module";

export const builder = {
  project: {
    describe: "Project root directory",
    type: "string",
    default: ".",
  },
};

export function handler(argv) {
  entry(argv.project);
}

function onSelect(root, prompt, configPath) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? docs(dirname(root), configPath)
      : docs(join(root, answer), configPath);
  };
}

function onFnSelect(root, fnMap, prompt, configPath) {
  return async function onAnswer(answer) {
    await prompt.clear();
    return answer == ".."
      ? docs(dirname(root))
      : docsFn(root, answer, fnMap[answer], configPath);
  };
}

function selectFn(root, fns, configPath) {
  const fnMap = Object.fromEntries(fns.map((fn) => [fn.name, fn]));
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
    .replace(/@[^\s]+/g, (matched) => blue(matched))
    .replace(
      /({[^}]+})(\s+)([^\s]+)/g,
      (_, type, spaces, name) => red(type) + spaces + magenta(name)
    );
}

function docsFn(root, name, info, configPath) {
  const doc = [
    info.returns ? `@returns ${info.returns}` : null,
    info.accepts ? `@accepts ${info.accepts.join(" ")}` : null,
    info.params.lengh ? `@params  ${info.params.join(" ")}` : null,
    " ",
    info.description,
  ]
    .filter(Boolean)
    .join("\n");
  console.log(
    [yellow(`Showing docs for ${root}:${name}\n`), colorize(doc), ""].join("\n")
  );
  const prompt = new enquirer.Toggle({
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
  const config = getPackageConfig(configPath);
  const sourceDir = getSourceFromConfig(configPath, config);
  const destination = getDestinationFromConfig(configPath, config);
  const cacheDir = join(destination, ".clio", "cache");
  const modulesDir = join(sourceDir, MODULES_PATH);
  const modulesDestDir = join(destination, MODULES_PATH);
  const relativeFile = relative(sourceDir, file);

  const { scope } = compileFile(
    relativeFile,
    config,
    configPath,
    modulesDir,
    modulesDestDir,
    dirname(configPath),
    "",
    "",
    cacheDir,
    { configs: {}, npmDeps: {}, npmDevDeps: {} }
  );
  const fns = Object.entries(scope)
    .filter(([_, info]) => info.description)
    .map(([name, info]) => ({ ...info, name }));
  return selectFn(file, fns, configPath);
}

function docsDirectory(projectPath, configPath) {
  const choices = readdirSync(projectPath)
    .filter((dir) => !dir.startsWith("."))
    .filter((name) => {
      const abs = join(projectPath, name);
      return isDirectory(abs) || isClioFile(name);
    });
  selectFile(projectPath, choices, configPath);
}

function isDirectory(dir) {
  return lstatSync(dir).isDirectory();
}

function isClioFile(file) {
  return file.endsWith(".clio");
}

export function docs(path, configPath) {
  return isDirectory(path)
    ? docsDirectory(path, configPath)
    : docsFile(path, configPath);
}

function entry(projectPath) {
  const configPath = join(projectPath, "clio.toml");
  return docs(projectPath, configPath);
}

export default {
  command,
  describe,
  builder,
  handler,
  docs,
};
