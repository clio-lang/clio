const { Rule } = require("../rule");
const arr = require("../arr");

const makeCall = call => arr`.then(flow => flow${call})`;

const make = (processedData, processedCalls) => [
  ...arr`await new Flow(scope, ${processedData})`,
  ...processedCalls.flat()
];

class flow extends Rule {
  parseCST() {
    const { data, calls } = this.cst;
    const processedData = this.generate(data);
    const generatedCalls = calls.map(call => this.generate(call));
    const processedCalls = [
      generatedCalls.shift(),
      ...generatedCalls.map(makeCall)
    ];
    return make(processedData, processedCalls);
  }
}

module.exports = { flow };
