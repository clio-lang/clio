const { Rule } = require("../rule");
const arr = require("../arr");
const implicit = require("../common/implicit");

const scoped = param => `scope.$.${param} = ${param}`;

const make = (fn, params, args, body, file) =>
  arr`scope.$.${fn} = new Fn(
    async function ${fn} (context, ${params.join(", ")}) {
      context.run = false;
      const { scope } = context;
      ${args.join(";")}
      ${body.join(";")}
  }, scope, Lazy, { filename: "${file}", name: "${fn}" })`;

class fn extends Rule {
  parseCST() {
    const { fn, parameters, body } = this.cst;
    const args = parameters.map(scoped);
    const processedBody = implicit(body.body).map(item => this.generate(item));
    return make(fn, parameters, args, processedBody, this.file);
  }
}

module.exports = {
  function: fn
};
