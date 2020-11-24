const { EventEmitter } = require("../../common");

class Client extends EventEmitter {
  constructor({ parentPort }) {
    super();
    this.parentPort = parentPort;
    this.postMessage = (message) => parentPort.postMessage(message);
    this.parentPort.on("message", (message) => this.onMessage(message));
  }
  connect() {
    this.emit("connect");
  }
  onMessage(data) {
    this.emit("message", JSON.parse(data));
  }
  send(data) {
    this.postMessage(JSON.stringify(data));
  }
}

module.exports.Client = Client;
