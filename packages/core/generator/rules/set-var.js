const { Rule } = require("../rule");
const arr = require("../arr");

const makeSymbol = raw => arr`.then(flow => flow.set("${raw}"))`;
const makeDotNotation = raws => arr`.then(flow => flow.set(${raws.join(".")}))`;

class setVar extends Rule {
  parseCST() {
    const { variable } = this.cst;
    const { name } = variable;
    return name == "symbol"
      ? makeSymbol(variable.raw)
      : makeDotNotation(variable.parts.map(({ raw }) => raw));
  }
}

module.exports = { setVar };
