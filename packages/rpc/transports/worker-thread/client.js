const { EventEmitter } = require("../../common");

class Client extends EventEmitter {
  constructor({ postMessage }) {
    super();
    this.postMessage = postMessage;
  }
  connect() {
    this.emit("connect");
  }
  onmessage(data) {
    this.emit("message", JSON.parse(data));
  }
  send(data) {
    this.postMessage(JSON.stringify(data));
  }
}

module.exports.Client = Client;
