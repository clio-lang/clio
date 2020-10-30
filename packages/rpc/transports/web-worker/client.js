const { EventEmitter } = require("../../common");

class Client extends EventEmitter {
  constructor({ postMessage }) {
    super();
    this.postMessage = postMessage;
  }
  connect() {
    this.emit("connect");
  }
  onmessage(event) {
    const { data } = event;
    this.emit("message", data);
  }
  send(data) {
    this.postMessage(data);
  }
}

module.exports.Client = Client;
