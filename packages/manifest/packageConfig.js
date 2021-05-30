const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

function parseDependencies(deps) {
  return Object.entries(deps).map((dep) => {
    return { name: dep[0], version: dep[1] };
  });
}

/* Package getters */

/**
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function getPackageConfig(filepath) {
  const file = fs.readFileSync(filepath);
  const config = toml.parse(file);

  const npmOverride = { ...config.npm };
  delete npmOverride.dependencies;
  delete npmOverride.devDependencies;

  const parsedConfig = {
    title: config.title,
    description: config.description,
    version: config.version,
    license: config.license,
    main: config.main,
    authors: config.authors,
    keywords: config.keywords,
    build: config.build,
    target: config.target,
    // eslint-disable-next-line camelcase
    git_repository: config.git_repository,
    documentation: config.documentation,
    scripts: config.scripts,
    servers: config.servers,
    workers: config.workers,
    executor: config.executor,
    dependencies: [],
    npm: { dependencies: [], devDependencies: [] },
    npmOverride,
  };

  if (config.dependencies)
    parsedConfig.dependencies = parseDependencies(config.dependencies);

  if (config.npm?.dependencies)
    parsedConfig.npm.dependencies = parseDependencies(config.npm.dependencies);

  if (config.npm?.devDependencies)
    parsedConfig.npm.devDependencies = parseDependencies(
      config.npm.devDependencies
    );

  return parsedConfig;
}

/**
 * @param {string} filepath Name of the file containing the configurations for the clio host in format `foo.toml`.
 */
function getHostConfig(filepath) {
  const file = fs.readFileSync(filepath);
  const config = toml.parse(file);

  const parsedConfig = {
    servers: config.servers,
    workers: config.workers,
  };

  return parsedConfig;
}

function removeKeys(object, ...keys) {
  const clone = { ...object };
  for (const key of keys) delete clone[key];
  return clone;
}

/* Package editing */

/**
 * Write a configuration object into the package config
 *
 * @param {object} config
 */
function writePackageConfig(configPath, config) {
  const cfg = {};

  if (config.dependencies?.length) {
    cfg.dependencies = {};
    for (const dep of config.dependencies) {
      cfg.dependencies[dep.name] = dep.version;
    }
  }

  if (config.npm?.dependencies?.length) {
    cfg.npm = cfg.npm || {};
    cfg.npm.dependencies = {};
    for (const dep of config.npm.dependencies) {
      cfg.npm.dependencies[dep.name] = dep.version;
    }
  }

  if (config.npm?.devDependencies?.length) {
    cfg.npm = cfg.npm || {};
    cfg.npm.devDependencies = {};
    for (const dep of config.npm.devDependencies) {
      cfg.npm.devDependencies[dep.name] = dep.version;
    }
  }

  const cfgStr = toml.stringify({
    ...removeKeys(config, "dependencies", "npmOverride"),
    ...cfg,
    npm: {
      ...config.npmOverride,
      ...cfg.npm,
    },
  });

  fs.writeFileSync(configPath, cfgStr);
}

/**
 * Add a dependency to the package config
 *
 * @param {string[]} dep - [ name, version ]
 */
function addDependency(configPath, dependency) {
  const config = getPackageConfig(configPath);
  const [name, version] = dependency;

  config.dependencies = config.dependencies || [];
  config.dependencies.push({ name, version });

  writePackageConfig(configPath, config);

  console.log(
    `Added ${name}@${version} to the dependencies list in ${configPath}`
  );
}

/**
 * Add a npm dependency to the package config
 *
 * @param {string[]} dep - [ name, version ]
 * @param {Object} flags - { dev }
 */
function addNpmDependency(configPath, dependency, flags) {
  const config = getPackageConfig(configPath);
  const [name, version] = dependency;

  if (flags.dev) {
    config.npm.devDependencies = config.npm.devDependencies || [];
    config.npm.devDependencies.push({ name, version });
  } else {
    config.npm.dependencies = config.npm.dependencies || [];
    config.npm.dependencies.push({ name, version });
  }

  writePackageConfig(configPath, config);

  console.log(
    `Added ${name}@${version} to the dependencies list in ${configPath}`
  );
}

/**
 * @param {Object} config Override config to write.
 */
function writeHostConfig(destination, config) {
  const configName = new Date().toISOString().replace(/:/g, "-");
  const base = path.join(destination, ".clio", ".host", configName);
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(
    path.join(base, "rpc.json"),
    JSON.stringify(config, null, 2)
  );
  fs.writeFileSync(
    path.join(base, "host.js"),
    [
      `const runner = require("clio-run/src/runners/auto.js");`,
      `const config = require("./rpc.json");`,
      `runner(require.resolve("../../../main.clio.js"), config, true);`,
    ].join("\n")
  );
  return configName;
}

module.exports = {
  addDependency,
  addNpmDependency,
  getPackageConfig,
  writePackageConfig,
  getHostConfig,
  writeHostConfig,
};
