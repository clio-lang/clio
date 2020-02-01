const fs = require("fs");
const path = require("path");
const { beef } = require("bean-parser");

const beefFile = path.join(__dirname, "clio.beef");
const clioModel = fs.readFileSync(beefFile, { encoding: "utf8" });
const model = beef(clioModel);

module.exports = model;
