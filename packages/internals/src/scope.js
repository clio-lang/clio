const proxify = scope =>
  new Proxy(scope, {
    set(scope, key, value) {
      return scope.set(key, value);
    },
    get(scope, key) {
      return scope.get(key);
    }
  });

class Scope {
  constructor(initial, outerScope, options = {}) {
    const { name } = options;
    this.outerScope = outerScope;
    this.scope = { ...initial };
    this.$ = proxify(this);
    this.name = name;
  }
  get(key) {
    if (key in this.scope) {
      return this.scope[key];
    } else if (this.outerScope) {
      return this.outerScope.get(key);
    } else {
      throw new Error(`${key} is not defined`);
    }
  }
  set(key, value) {
    this.scope[key] = value;
    return value;
  }
  extend(object, keys, prefix) {
    if (!(object instanceof Scope)) object = new Scope(object);
    keys = keys || Object.keys(object.scope);
    if (prefix) {
      const result = {};
      for (const key of keys) {
        result[key] = object.get(key);
      }
      this.set(prefix, result);
    } else {
      if (Array.isArray(keys)) {
        for (const key of keys) {
          this.set(key, object.get(key));
        }
      } else {
        for (const [key, dest] of Object.entries(keys)) {
          this.set(dest, object.get(key));
        }
      }
    }
  }
}

const scope = (initial, outerScope) => new Scope(initial, outerScope);

module.exports.scope = scope;
module.exports.Scope = Scope;
