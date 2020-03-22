const { Rule } = require("../rule");
const arr = require("../arr");

const make = (body, file) =>
  arr`const { Fn, Flow, Lazy, Scope, Array, Range, Method, builtins, moduleName, rpc } = require('clio-internals');
const scope = new Scope(builtins, null);
${body}
module.exports = scope;
rpc.init(scope);
//# sourceMappingURL=${file}.js.map
`;

class clio extends Rule {
  parseCST() {
    const { body } = this.cst;
    const processedBody = body.map(item => this.generate(item));
    const generated = processedBody.join(";");
    return make(generated, this.file);
  }
}

module.exports = { clio };
