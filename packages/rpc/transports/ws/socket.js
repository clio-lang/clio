const { EventEmitter } = require("../../common");

class WSSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.on("message", data => this.onData(data));
  }
  send(data) {
    this.socket.send(JSON.stringify(data));
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

module.exports.WSSocket = WSSocket;
