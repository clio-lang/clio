const { EventEmitter } = require("clio-lang-internals");

module.exports.randomId = () => Math.floor(Math.random() * 0xffffffff);
module.exports.EventEmitter = EventEmitter;
