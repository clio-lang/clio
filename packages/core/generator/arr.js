/**
 * To be used as a template tag
 * Turns a string into an array
 * (Can be used to pass a string to SourceNode)
 * @param {Array[String]} strs Array of strings
 * @param  {...any} vals Array of values
 */
const arr = (strs, ...vals) =>
  strs.reduce((prev, curr, i) => [...prev, curr, vals[i]], []).filter(Boolean);

module.exports = arr;
