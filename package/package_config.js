const path = require("path");
const fs = require("fs");
const toml = require("@iarna/toml");

const configFileName = "cliopgk.toml";

/**
 *
 * @param {string} filepath Optional name of file containing the configurations for the clio package in format `foo.toml`.
 */
function get_package_config(
  filepath = path.join(process.cwd(), configFileName)
) {
  const file = fs.readFileSync(filepath);
  const packageConfig = toml.parse(file);

  return {
    title: packageConfig.title,
    description: packageConfig.description,
    version: packageConfig.version,
    license: packageConfig.license,
    main: packageConfig.main,
    author: {
      name: packageConfig.author.name,
      email: packageConfig.author.email,
      website: packageConfig.author.website
    },
    keywords: packageConfig.keywords,
    git_repository: packageConfig.git_repository,
    documentation: packageConfig.documentation,

    scripts: packageConfig.scripts,
    dependencies: Object.entries(packageConfig.dependencies).map(dep => {
      return { name: dep[0], version: dep[1] };
    })
  };
}

function write_package_config(
  cfg,
  filePath = path.join(process.cwd(), configFileName)
) {
  const deps = {};
  console.debug(cfg.dependencies);
  cfg.dependencies.forEach(dep => (deps[dep.name] = dep.version));
  const cfgStr = toml.stringify({ ...cfg, dependencies: deps });
  fs.writeFileSync(filePath, cfgStr);
}

/**
 *
 * @param {string[]} dep
 */
function addDependency(dep) {
  const config = get_package_config();
  const depName = dep[0];
  const depVersion = dep[1];
  console.debug("Old deps:", config.dependencies);
  config.dependencies.push({ name: depName, version: depVersion });
  console.debug("New deps:", config.dependencies);
  write_package_config(config);
}

/**
 * @returns {{name, version}}
 */
function getPackageDependencies() {
  const config = get_package_config();
  console.log(config);
  return config.dependencies;
}

module.exports = {
  get_package_config,
  write_package_config,
  addDependency,
  getPackageDependencies,
  configFileName
};
