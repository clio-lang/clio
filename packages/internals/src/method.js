class Method {
  constructor(...keys) {
    this.keys = keys;
  }
  get(object) {
    const keys = [...this.keys];
    let method = object;
    while (keys.length) method = method[keys.shift()];
    return method;
  }
}

module.exports.Method = Method;
