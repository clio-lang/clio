const { EventEmitter, emitter } = require("./emitter");

module.exports.remote = require("./remote");
module.exports.iterator = require("./iterator");
module.exports.range = require("./range").range;
module.exports.randomId = require("./random");
module.exports.slice = require("./slice");
module.exports.f = require("./format");
module.exports.Any = require("./types").Any;
module.exports.EventEmitter = EventEmitter;
module.exports.emitter = emitter;

const decorators = require("./decorators");
module.exports.help = decorators.help;
module.exports.describe = decorators.describe;
module.exports.returns = decorators.returns;
module.exports.check = decorators.check;
module.exports.params = decorators.params;
