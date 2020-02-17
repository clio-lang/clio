const { Rule } = require("../rule");
const arr = require("../arr");
const implicit = require("../common/implicit");

const scoped = param => `scope.$.${param} = ${param}`;

const make = (fn, params, args, body) =>
  arr`scope.$.${fn} = new Fn(
    function ${fn} (scope, ${params.join(", ")}) {
      ${args.join(";")}
      ${body.join(";")}
  }, scope, Lazy)`;

class fn extends Rule {
  parseCST() {
    const { fn, parameters, body } = this.cst;
    const args = parameters.map(scoped);
    const processedBody = implicit(body.body).map(item => this.generate(item));
    return make(fn, parameters, args, processedBody);
  }
}

module.exports = {
  function: fn
};
