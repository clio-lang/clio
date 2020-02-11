const toString = Object.prototype.toString;
const fnToString = Function.prototype.toString;
const reHostCtor = /^\[object .+?Constructor\]$/;
const reNative = RegExp(
  "^" +
    String(toString)
      .replace(/[.*+?^${}()|[\]\/\\]/g, "\\$&")
      .replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") +
    "$"
);

const isNative = fn => {
  const type = typeof fn;
  return type == "function"
    ? reNative.test(fnToString.call(fn))
    : (fn && type == "object" && reHostCtor.test(toString.call(fn))) || false;
};

const getParenEnd = source => {
  let i = 0,
    lpar = 0,
    rpar = 0;
  while (i < source.length - 1) {
    if (source[i] == "{" && lpar == rpar) return i;
    if (source[i] == ">" && source[i - 1] == "=" && lpar == rpar) return i - 1;
    if (source[i] == "(") lpar++;
    if (source[i] == ")") rpar++;
    i++;
  }
};

const getArity = fn => {
  const source = fn.toString();
  if (isNative(fn)) return fn.length;
  const end = getParenEnd(source);
  let paramText = source.slice(0, end);
  paramText = paramText.replace(/^[^(]*?\(/, "").replace(/\) *$/, "");
  paramText = paramText.replace(/('|")([^\\]|\\.)*?\1/, "");
  paramText = paramText.replace(/(\(([^(]+|\1)+\))/, "");
  paramText = paramText.replace(/(\[([^[]+|\1)+\])/, "");
  paramText = paramText.replace(/({([^{]+|\1)+})/, "");
  paramText = paramText.replace(/[^,.]/gi, "");
  if (paramText.includes("...")) return Infinity;
  return paramText.length + 1;
};

module.exports.getArity = getArity;
