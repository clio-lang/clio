const help = (fn) => console.log(fn.__doc__);

const describe = (description, fn) => {
  fn.__doc__ = description;
  return fn;
};

const returns = (type, fn) => {
  fn.__returns__ = type;
  return fn;
};

const params = (...params) => {
  const fn = params.pop();
  fn.__paramTypes__ = params;
  return fn;
};

const checkType = (value, type) => {
  if (Array.isArray(type)) {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every((item, index) => checkType(item, type[index]));
  }
  if (type === Number) {
    return typeof value === "number" || value instanceof Number;
  }
  if (type === String) {
    return typeof value === "string" || value instanceof String;
  }
  return value instanceof type;
};

const nameOfType = (value) =>
  value?.constructor?.name || Object.prototype.toString.call(value);

const typeName = (type) => type?.name || Object.prototype.toString.call(type);

const check = (fn) => {
  const wrapped = (...args) => {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const paramType = wrapped.__paramTypes__[i];
      const match = checkType(arg, paramType);
      if (!match) {
        const vTypeName = nameOfType(arg);
        const pTypeName = typeName(paramType);
        throw new Error(
          `Argument of type ${vTypeName} at position ${i} does not satisfy parameter of type ${pTypeName}`
        );
      }
    }
    const result = fn(...args);
    if (wrapped.__returns__) {
      const match = checkType(result, wrapped.__returns__);
      if (!match) {
        const rTypeName = typeName(wrapped.__returns__);
        const vTypeName = nameOfType(result);
        throw new Error(
          `Returned value ${result} with type ${vTypeName} does not satisfy return type of ${rTypeName}`
        );
      }
    }
    return result;
  };
  wrapped.__paramTypes__ = fn.__paramTypes__;
  wrapped.__doc__ = fn.__doc__;
  wrapped.__returns__ = fn.__returns__;
  return wrapped;
};

module.exports.help = help;
module.exports.describe = describe;
module.exports.returns = returns;
module.exports.check = check;
module.exports.params = params;
