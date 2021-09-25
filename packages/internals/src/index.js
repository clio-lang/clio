const { EventEmitter, emitter } = require("./emitter");

module.exports.remote = require("./remote");
module.exports.iterator = require("./iterator");
module.exports.range = require("./range").range;
module.exports.randomId = require("./random");
module.exports.slice = require("./slice");
module.exports.f = require("./format");
module.exports.EventEmitter = EventEmitter;
module.exports.emitter = emitter;

const doc = require("./doc");
module.exports.help = doc.help;
module.exports.describe = doc.describe;
module.exports.returns = doc.returns;
