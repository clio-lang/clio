const { EventEmitter, randomId } = require("./common");
const { AsyncResource } = require("async_hooks");

class Channel extends EventEmitter {
  constructor(id) {
    super();
    this.id = id || "channel." + randomId(64);
    // TODO: this needs to be improved
    this.resource = AsyncResource ? new AsyncResource(this.id) : null;
  }
  close() {
    this.emit("close");
    return this;
  }
  send(event, ...args) {
    this.emit("send", event, ...args);
    return this;
  }
}

module.exports.Channel = Channel;
module.exports.channel = (...args) => new Channel(...args);
