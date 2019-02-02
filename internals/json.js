var { Decimal } = require('../internals/types');

function jsonReplacer(key, value) {
  if (value.toNumber) {
    return value.toNumber();
  }
  if (value.constructor == Array) {
    return value.map(function (v, k) {
      return jsonReplacer(k, v); // good job javascript!
    });
  }
  return value;
}

function jsonReviver(key, value) {
  if (value.constructor == Number) {
    return Decimal(value);
  }
  if (value.constructor == Array) {
    return value.map(function (v, k) {
      return jsonReviver(k, v); // good job javascript!
    });
  }
  return value;
}

module.exports.jsonReviver = jsonReviver
module.exports.jsonReplacer = jsonReplacer
