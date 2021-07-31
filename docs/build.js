const { execSync } = require("child_process");
const { resolve } = require("path");
const { rmSync, mkdirSync, writeFileSync } = require("fs");

const tags = execSync("git tag").toString().split("\n").filter(Boolean);
const versions = tags
  .filter((tag) => tag.startsWith("docs-v"))
  .map((tag) => tag.slice(6));

process.cwd(resolve(__dirname));
rmSync("./build", { recursive: true });
mkdirSync("./build");

for (const version of versions) {
  execSync(`git checkout docs-v${version}`);
  writeFileSync("./build/versions.py", `versions = ${versions}`);
  execSync(`sphinx-build -b html source build/html/versions/${version}`);
}

execSync(`git checkout develop`);
writeFileSync("./build/versions.py", `versions = ${versions}`);
execSync(`sphinx-build -b html source build/html/versions/develop`);
