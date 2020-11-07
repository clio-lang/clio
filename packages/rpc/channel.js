const { EventEmitter, randomId } = require("./common");

class Channel extends EventEmitter {
  constructor(id) {
    this.id = id || "channel." + randomId(64);
  }
  close() {
    this.emit("close");
  }
}

module.exports.Channel = Channel;
module.exports.channel = (...args) => new Channel(...args);
