const { spawnSync } = require("child_process");

const npmCommand = (command, destination, args, forkOptions = {}) => {
  const argv = args && args.length ? ["--", ...args] : [];
  const npm = process.platform == "win32" ? "npm.cmd" : "npm";
  return spawnSync(npm, [command, ...argv], {
    cwd: destination,
    stdio: "inherit",
    ...forkOptions,
  });
};

const npmRun = (command, destination, args, forkOptions = {}) => {
  const argv = args && args.length ? ["--", ...args] : [];
  const npm = process.platform == "win32" ? "npm.cmd" : "npm";
  return spawnSync(npm, ["run", command, ...argv], {
    cwd: destination,
    stdio: "inherit",
    ...forkOptions,
  });
};

const js = {
  async build() {},
  async run(destination, args, forkOptions) {
    return npmRun("start", destination, args, forkOptions);
  },
  async host(destination, args) {
    return npmRun("host", destination, args);
  },
};

const platforms = { js };

function getPlatform(name) {
  const platform = platforms[name];
  if (!platform) throw new Error(`Platform "${name}" is not supported`);
  return platform;
}

exports.getPlatform = getPlatform;
exports.npmCommand = npmCommand;
