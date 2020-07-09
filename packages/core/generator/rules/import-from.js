const { Rule } = require("../rule");
const arr = require("../arr");

const make = (path, names) =>
  arr`scope.extend(require(${path}), [${names.join(",")}])`;

const makeMicroService = (path, type, name) =>
  arr`scope.$.${name} = rpc.${type}.require("${path}/${name}")`;

class importFromStatement extends Rule {
  parseCST() {
    const { path, names } = this.cst;
    const isMicroService = path.raw.match(/^(tcp:|ipc:|ws:|wss:)/);
    if (isMicroService) {
      const protocol = path.split(":").shift();
      const type = protocol == "wss" ? "ws" : protocol;
      return names.map(name => makeMicroService(path, type, name));
    }
    const processedPath = this.generate(path);
    const processedNames = names.map(name => `"${name.raw}"`);
    return make(processedPath, processedNames);
  }
}

module.exports = { importFromStatement };
