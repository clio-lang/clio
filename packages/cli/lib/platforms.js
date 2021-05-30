const { spawn } = require("child_process");

const npmCommand = (command, destination, args) => {
  const argv = args && args.length ? ["--", ...args] : [];
  const npm = process.platform == "win32" ? "npm.cmd" : "npm";
  return spawn(npm, ["run", command, ...argv], {
    cwd: destination,
    stdio: "inherit",
  });
};

const js = {
  async build() {},
  async run(destination, args) {
    npmCommand("start", destination, args);
  },
  async host(destination, args) {
    npmCommand("host", destination, args);
  },
};

const platforms = { js };

function getPlatform(name) {
  const platform = platforms[name];
  if (!platform) throw new Error(`Platform "${name}" is not supported`);
  return platform;
}

exports.getPlatform = getPlatform;
