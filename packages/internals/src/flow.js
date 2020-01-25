class JSFn {
  constructor(fn) {
    this.fn = fn;
  }
  call(...args) {
    return this.fn(...args);
  }
}

class Flow {
  constructor(scope, data) {
    this.data = data;
    this.scope = scope;
  }
  pipe(fn, ...args) {
    if (fn instanceof Method) fn = fn.get(this.data);
    if (typeof fn == "function") fn = new JSFn(fn);
    const data = fn.call(this.data, ...args);
    return new Flow(this.scope, data);
  }
  map(fn, ...args) {
    const map = fn.isLazy ? this.data.lazyMap : this.data.map;
    const data = map.call(this.data, item => {
      let fun = fn instanceof Method ? fn.get(this.data) : fn;
      if (typeof fun == "function") fun = new JSFn(fun);
      return fun.call(item, ...args);
    });
    return new Flow(this.scope, data);
  }
  set(key) {
    if (key.includes(".")) {
      const [first, ...rest] = key.split(".");
      const last = rest.pop();
      let object = this.scope.$[first];
      while (rest.length) object = object[rest.shift()];
      object[last] = this.data;
    } else {
      this.scope.$[key] = this.data;
    }
    return this;
  }
}

const flow = (scope, data) => new Flow(scope, data);

module.exports.flow = flow;
module.exports.Flow = Flow;

const { Method } = require("./method");
