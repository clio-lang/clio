import { basename, dirname } from "path";
import { error, info, success, trace } from "../lib/colors.js";

import { fetchDependencies } from "clio-manifest";
import { rmSync } from "fs";
import { spawnSync } from "child_process";

const TEMPLATES = ["node", "web"];
const TARGETS = ["js"];

export const command = "new <project>";
export const describe = "Create a new Clio project";
export const builder = {
  project: {
    describe: "name of the project",
    type: "string",
  },
  target: {
    describe: "Choose a target for compilation (eg. JavaScript)",
    type: "string",
    default: "js",
  },
  template: {
    describe: "Template to use for scaffolding",
    type: "string",
    default: "node",
  },
  debug: {
    describe: "Show stack traces instead of error messages",
    type: "boolean"
  }
};
export function handler(argv) {
  createPackage(argv.project, targetAlias(argv.target), argv.template, argv.debug);
}

function targetAlias(target) {
  if (!target) return "js";
  if (target.toLowerCase() === "javascript") return "js";
}

function preValidations(packageName, target) {
  if (!packageName) {
    throw new Error("A project name is required.");
  }
  if (!TARGETS.includes(target)) {
    throw new Error(
      'New command only supports "JavaScript" target at the moment.'
    );
  }
  const result = spawnSync("git");
  if (result.error) {
    throw new Error("Git is required to create a new Clio project.");
  }
}

function getRepoName(template) {
  return TEMPLATES.includes(template)
    ? `clio-lang/template-${template}`
    : template;
}

function getRepoAddr(name) {
  if (name.match(/^https?:\/\//)) return name;
  if (name.match(/^git@/)) return name;
  return `https://github.com/${name}`;
}

async function createPackageJs(packageName, template) {
  const repoName = getRepoName(template);
  const repoAddr = getRepoAddr(repoName);

  process.chdir(dirname(packageName));
  spawnSync("git", ["clone", repoAddr, packageName]);

  process.chdir(basename(packageName));
  rmSync(".git", { recursive: true });

  await fetchDependencies("./clio.toml");
  info("Added Clio dependencies");

  spawnSync("git", ["init"]);
  spawnSync("git", ["add", "-A"]);
  spawnSync("git", ["commit", "-m", "Initial Commit"]);
  info("Initialized new git repository.");

  info("Initialization Complete!");
  success(
    `Run 'cd ${packageName}' to open, then 'clio run' to run the project!`
  );
}

export async function createPackage(
  packageName,
  target = "js",
  template = "node",
  isDebugMode = false
) {
  try {
    preValidations(packageName, target);
    if (target === "js") return await createPackageJs(packageName, template);
  } catch (e) {
    (argv.debug ? trace : error)(e);
    process.exit(1);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
  targetAlias,
  preValidations,
  getRepoName,
  getRepoAddr,
  createPackageJs,
  createPackage,
};
