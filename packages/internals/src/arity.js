const toString = Object.prototype.toString;
const fnToString = Function.prototype.toString;
/**
 * Regex to match host constructors (Safari > 4)
 * Taken from https://davidwalsh.name/detect-native-function
 * @type {RegExp}
 */
const reHostCtor = /^\[object .+?Constructor\]$/;
/**
 * Regex to match native function declarations
 * Taken from https://davidwalsh.name/detect-native-function
 * @type {RegExp}
 */
const reNative = RegExp(
  "^" +
    String(toString)
      .replace(/[.*+?^${}()|[\]\/\\]/g, "\\$&")
      .replace(/toString|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") +
    "$"
);

/**
 * Check if a function is a native function
 * @param {Function} fn Function to check
 * @returns {Boolean}
 */
const isNative = fn => {
  const type = typeof fn;
  return type == "function"
    ? reNative.test(fnToString.call(fn))
    : (fn && type == "object" && reHostCtor.test(toString.call(fn))) || false;
};

/**
 * Parses a function source code, returning index of
 * the place where function parameter definition ends
 * @param {String} source source code of a function
 * @returns {Number} index where parameter definition ends
 */
const getParamEnd = source => {
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

/**
 * Checks how many arguments a function accepts
 * @param {Function} fn function to check
 * @returns {Number|Infinity} arity of the function
 */
const getArity = fn => {
  const source = fn.toString();
  if (isNative(fn)) return fn.length;
  const end = getParamEnd(source);
  let paramText = source.slice(0, end);
  paramText = paramText.replace(/^[^(]*?\(/, "").replace(/\) *$/, "");
  paramText = paramText.replace(/(['"])([^\\]|\\.)*?\1/g, "");
  while (paramText != (paramText = paramText.replace(/\[[^\[\]]+\]/g, "")));
  while (paramText != (paramText = paramText.replace(/\([^()]+\)/g, "")));
  while (paramText != (paramText = paramText.replace(/{[^{}]+}/g, "")));
  paramText = paramText.replace(/[^,.]/gi, "");
  if (paramText.includes("...")) return Infinity;
  return paramText.length + 1;
};

module.exports.getArity = getArity;
