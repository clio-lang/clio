/*
  Allows doing scope.key instead of
  doing scope.get('key')
*/
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
  constructor(initial, outerScope) {
    this.outerScope = outerScope;
    this.scope = { ...initial };
    this.$ = proxify(this);
  }
  get(key) {
    if (key in this.scope) {
      return this.scope[key];
    } else if (this.outerScope) {
      return this.outerScope.get(key);
    } else {
      throw "Not defined";
    }
  }
  set(key, value) {
    this.scope[key] = value;
    return value;
  }
  extend(object, keys) {
    if (!(object instanceof Scope)) object = new Scope(object);
    if (!keys) keys = Object.keys(object.scope);
    for (const key of keys) {
      this.set(key, object.get(key));
    }
  }
}

const scope = (initial, outerScope) => new Scope(initial, outerScope);

module.exports = { scope, Scope };
