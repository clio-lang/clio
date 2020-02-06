class Method {
  constructor(...keys) {
    this.keys = keys;
  }
  get(object) {
    const keys = [...this.keys];
    let method = object;
    let thisArg = method;
    while (keys.length) {
      thisArg = method;
      method = method[keys.shift()];
    }
    return (...args) => method.call(thisArg, ...args);
  }
}

module.exports.Method = Method;
