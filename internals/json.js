var { Decimal, EventEmitter } = require('../internals/types');

function jsonReplacer(key, value) {
  if ([null, undefined].includes(value)) {
    return value
  }
  if (value.toNumber) {
    return `clio::number::${value.toString()}`;
  }
  if (value.constructor == Array) {
    return value.map(function (v, k) {
      return jsonReplacer(k, v); // good job javascript!
    });
  }
  if (value.constructor == EventEmitter) {
    return `clio::emitter::${value.uuid}`; // this only works for host, // FIXME
  }
  if (value.constructor == Object) {
    var result = {};
    for (var key in value) {
      if (value.hasOwnProperty(key)) {
        result[key] = jsonReplacer(key, value[key])
      }
    }
    return result;
  }
  return value;
}

function jsonReviver(key, value) {
  if ([null, undefined].includes(value)) {
    return value;
  }
  if (value.constructor == Number) {
    return Decimal(value);
  }
  if ((value.constructor == String) && (value.startsWith('clio::'))) {
    value = value.slice(6);
    if (value.startsWith('number::')) {
      value = value.slice(8);
      return Decimal(value);
    } else if (value.startsWith('emitter::')) {
      value = value.slice(9);
      var emitter = new EventEmitter({
        wildcard: true,
        newListener: false,
        maxListeners: 128,
      });
      emitter.uuid = value;
      return emitter;
    }
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
