const { execSync } = require("child_process");
const { resolve } = require("path");
const { rmSync, mkdirSync, writeFileSync } = require("fs");

const currentBranch = execSync("git branch --show-current")
  .toString()
  .trimEnd();

const tags = execSync("git tag").toString().split("\n").filter(Boolean);
const versions = tags
  .filter((tag) => tag.startsWith("docs-v"))
  .map((tag) => tag.slice(6));

process.cwd(resolve(__dirname));
rmSync("./build", { recursive: true });
mkdirSync("./build");

const pyVersionsStr = ['"develop"', ...versions.map((v) => `"${v}"`)].join(",");
const pyVersionsArray = `[${pyVersionsStr}]`;

const pyVersions = (version) =>
  writeFileSync(
    "./source/versions.py",
    `versions = ${pyVersionsArray}\ncurrent_version = "${version}"`
  );

const build = (target) =>
  execSync(`sphinx-build -b html source build/html/versions/${target}`);

const generate = (tag, target = tag) => {
  checkout(tag);
  pyVersions(target);
  build(target);
};

const checkout = (tag) => execSync(`git checkout ${tag}`);

for (const version of versions) {
  generate(`docs-v${version}`, version);
}

generate(currentBranch, "develop");
