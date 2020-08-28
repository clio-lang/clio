const { Rule } = require("../rule");
const arr = require("../arr");
const implicit = require("../common/implicit");

const scoped = (param) => `scope.$.${param} = ${param}`;

const make = (fn, params, args, body, file, outerFns) =>
  arr`${outerFns.join(";\n")}\nscope.$.${fn} = new Fn(
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
    const functions = body.body
      .filter(({ name }) => name === "function")
      .map((innerFn) => ({
        ...innerFn,
        fn: fn + "_$_" + innerFn.fn,
      }));
    const strippedBody = body.body.map((item) => {
      if (item.name === "function")
        return {
          ...item,
          name: "scopedFn",
        };
      return item;
    });
    const processedBody = implicit(strippedBody).map((item) =>
      this.generate(item)
    );
    const processedFunctions = functions.map((item) => this.generate(item));
    return make(
      fn,
      parameters,
      args,
      processedBody,
      this.file,
      processedFunctions
    );
  }
}

module.exports = {
  function: fn,
};
