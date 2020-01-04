const fs = require("fs");
const path = require("path");
const { format } = require("prettier");
const { spawn } = require("child_process");
const ora = require("ora");
const { generator } = require("../../core/generator");
const { error, info, success } = require("../lib/colors");

const {
  CONFIGFILE_NAME,
  fetchNpmDependencies,
  getPackageConfig,
  hasInstalledNpmDependencies
} = require("../../package/index");

const flatten = arr => arr.reduce((acc, val) => acc.concat(val), []);

const isDir = dir => fs.lstatSync(dir).isDirectory();
const readDir = dir => fs.readdirSync(dir);
const walkDir = dir => readDir(dir).map(f => walk(path.join(dir, f)));
const walk = dir => (isDir(dir) ? flatten(walkDir(dir)) : [dir]);

const isClioFile = file => file.endsWith(".clio");
const isNotClioFile = file => !file.endsWith(".clio");
const getClioFiles = dir => walk(dir).filter(isClioFile);
const getNonClioFiles = dir => walk(dir).filter(isNotClioFile);

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
  const config = getPackageConfig();
  const buildConfig = config.build;
  const buildDirectory = buildConfig.directory;

  if (!buildDirectory) {
    throw new Error(
      `The build directory is missing on your "${CONFIGFILE_NAME}".\n\nExample:\n\n[build]\ndirectory = "build"\n`
    );
  }

  return path.join(source, `${buildDirectory}/${target}`);
}

function getBuildTarget(targetOverride, config = getPackageConfig()) {
  const buildConfig = config.build;

  if (!buildConfig) {
    throw new Error(
      `No build configuration has been found. It is a "[build]" section on you "${CONFIGFILE_NAME}" file.`
    );
  }

  const buildTarget =
    targetOverride ||
    (buildConfig.target in config.target ? config.target[buildConfig.target].target : buildConfig.target);

  if (!buildTarget) {
    throw new Error(
      `"target" field is missing in your ${CONFIGFILE_NAME} file. You can override the target with the "--target" option.`
    );
  }

  return buildTarget;
}

function getSourceFromConfig(source, target) {
  const config = getPackageConfig();
  const buildConfig = config.build;

  if (!buildConfig) {
    throw new Error(
      `No build configuration has been found. It is a "[build]" section on your "${CONFIGFILE_NAME}" file.`
    );
  }

  const buildSource =
    buildConfig.target in config.target ? config.target[buildConfig.target].directory : buildConfig.source;

  if (!buildSource) {
    throw new Error(`Could not find a source directory for ${target} in your ${CONFIGFILE_NAME} file.`);
  }

  return path.join(source, buildSource);
}

const build = async (source, dest, targetOverride, skipBundle) => {
  let progress = ora();
  const target = getBuildTarget(targetOverride);
  const destination = dest || getDestinationFromConfig(source, target);
  const sourceDir = getSourceFromConfig(source, target);

  info(`Creating build for ${target}`);
  try {
    progress.text = "Compiling...";
    progress.start();
    const files = getClioFiles(source);
    for (const file of files) {
      const relativeFile = path.relative(sourceDir, file);
      const destFile = path.join(destination, `${relativeFile}.js`);
      const destDir = path.dirname(destFile);
      const contents = fs.readFileSync(file, "utf8");
      const compiled = await generator(contents);
      const formatted = format(compiled, { parser: "babel" });
      mkdir(destDir);
      fs.writeFileSync(destFile, formatted, "utf8");
    }
    progress.succeed();
  } catch (e) {
    progress.fail();
    error(e, "Compilation");
    process.exit(3);
  }

  const nonClioFiles = getNonClioFiles(sourceDir);
  for (const file of nonClioFiles) {
    const relativeFile = path.relative(sourceDir, file);
    const destFile = path.join(destination, relativeFile);
    const destDir = path.dirname(destFile);
    mkdir(destDir);
    fs.copyFileSync(file, destFile);
  }

  try {
    progress.text = "Installing npm dependencies (this may take a while)...";
    progress.start();
    const packageJsonPath = path.join(destination, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      let nodeDeps = {
        "clio-internals": "latest"
      };

      if (getPackageConfig(path.join(source, CONFIGFILE_NAME)).npm_dependencies) {
        getPackageConfig(path.join(source, CONFIGFILE_NAME)).npm_dependencies.forEach(dep => {
          nodeDeps[dep.name] = dep.version;
        });
      }
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(
          {
            dependencies: nodeDeps,
            devDependencies: {
              parcel: "^1.12.4"
            },
            scripts: {
              build: "parcel build index.html --out-dir public",
              run: "parcel index.html --out-dir public"
            }
          },
          null,
          2
        )
      );
    }

    if (!hasInstalledNpmDependencies(destination)) {
      await fetchNpmDependencies(destination);
    }
    progress.succeed();
  } catch (e) {
    progress.fail();
    error(e, "Dependency Install");
    process.exit(4);
  }

  try {
    // FIXME Create a runner for this and for node
    if (!skipBundle && target === "browser") {
      progress.text = "Building for browser (use --skip-bundle to skip)...";
      progress.start();
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="X-UA-Compatible" content="ie=edge" />
          <title>Document</title>
        </head>
        <body>
          <script src="src/main.clio.js"></script>
        </body>
      </html>
      `;
      fs.writeFileSync(path.join(destination, "index.html"), htmlContent);
      await buildProject(destination);
      progress.succeed();
      success("Project built successfully!");
    }
  } catch (e) {
    progress.fail();
    error(e, "Bundling");
    process.exit(5);
  }
};

const buildProject = cwd =>
  new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], { cwd });
    build.on("close", resolve);
    build.on("error", reject);
  });

const command = "build [target] [source] [destination]";
const desc = "Build a Clio project";
const handler = argv => build(argv.source, argv.destination, argv.target, argv["skip-bundle"]);
const builder = {
  source: {
    describe: "source directory to read from",
    type: "string",
    default: path.resolve(".")
  },
  destination: {
    describe: "destination directory to write to",
    type: "string"
  },
  target: {
    describe: "An override for the default project target.",
    type: "string"
  },
  "skip-bundle": {
    describe: "Does not produces a bundle for browsers.",
    type: "boolean"
  }
};

module.exports = {
  build,
  command,
  desc,
  builder,
  handler
};
