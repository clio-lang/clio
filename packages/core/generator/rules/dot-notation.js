const { Rule } = require("../rule");
const arr = require("../arr");

const make = names => arr`scope.$.${names.join(".")}`;

class dotNotation extends Rule {
  parseCST() {
    const { parts } = this.cst;
    const names = parts.map(part =>
      part.name == "symbol"
        ? part.raw
        : this.generate(part)
            .toString()
            .replace(/scope\.\$./, "")
    );
    return make(names);
  }
}

module.exports = { dotNotation };
