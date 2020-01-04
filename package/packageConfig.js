const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const { CONFIGFILE_NAME } = require("./config");

/* Package getters */

/**
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function getPackageConfig(filepath = path.join(process.cwd(), CONFIGFILE_NAME)) {
  const file = fs.readFileSync(filepath);
  const config = toml.parse(file);

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
    scripts: config.scripts
  };

  if (config.dependencies) {
    parsedConfig.dependencies = Object.entries(config.dependencies).map(dep => {
      return { name: dep[0], version: dep[1] };
    });
  }

  if (config.npm_dependencies) {
    // eslint-disable-next-line camelcase
    parsedConfig.npm_dependencies = Object.entries(config.npm_dependencies).map(dep => {
      return { name: dep[0], version: dep[1] };
    });
  }

  return parsedConfig;
}

/* Package editing */

/**
 * Write a configuration object into the package config
 *
 * @param {object} config
 */
function writePackageConfig(config, directory = process.cwd()) {
  const deps = {};
  config.dependencies.forEach(dep => (deps[dep.name] = dep.version));
  const cfgStr = toml.stringify({ ...config, dependencies: deps });
  const filePath = path.join(directory, CONFIGFILE_NAME);
  fs.writeFileSync(filePath, cfgStr);
}

/**
 * Add a dependency to the package config
 *
 * @param {string[]} dep - [ name, version ]
 */
function addDependency([name, version]) {
  const config = getPackageConfig();
  config.dependencies.push({ name, version });
  writePackageConfig(config);

  console.log(`Added ${name}@${version} to the dependencies list in ${CONFIGFILE_NAME}`);
}

module.exports = {
  CONFIGFILE_NAME,
  addDependency,
  getPackageConfig,
  writePackageConfig
};
