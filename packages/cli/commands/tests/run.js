const tmp = require("tmp");
const path = require("path");
const fs = require("fs");
const { createPackage } = require("../new");
const { run } = require("../run");
const deps = require("../deps_commands/get");
const packageConfig = require("clio-manifest");

const test = async () => {
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  const process = await run(dir.name, { stdio: "pipe" });
  process.stdout.on("data", function (data) {
    console.log("STDOUT", data.toString());
  });
  dir.removeCallback();
};

test();
