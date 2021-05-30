const { spawnSync } = require("child_process");
const degit = require("degit");

const { fetchDependencies } = require("clio-manifest");
const { error, info, success } = require("../lib/colors");

const TEMPLATES = ["node", "web"];
const TARGETS = ["js"];

exports.command = "new <project>";
exports.desc = "Create a new Clio project";
exports.builder = {
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
    describe: "What template should be used for scaffolding the project?",
    type: "string",
    default: "node",
  },
};
exports.handler = function (argv) {
  createPackage(argv.project, targetAlias(argv.target), argv.template);
};

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

async function createPackageJs(packageName, template) {
  const repo = TEMPLATES.includes(template)
    ? `clio-lang/template-${template}#master`
    : template;

  const emitter = degit(repo, {
    cache: false,
    force: true,
  });

  await emitter.clone(packageName);

  process.chdir(packageName);

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

async function createPackage(packageName, target = "js", template = "node") {
  try {
    preValidations(packageName, target);
    if (target === "js") return await createPackageJs(packageName, template);
  } catch (e) {
    console.trace(e);
    error(e);
    process.exit(1);
  }
}

exports.createPackage = createPackage;
