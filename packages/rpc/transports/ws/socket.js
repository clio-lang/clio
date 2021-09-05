const { EventEmitter } = require("../../common");

class WSSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.on("message", (data) => this.onData(data));
  }
  send(data) {
    this.socket.send(data);
  }
  onData(data) {
    this.emit("message", data);
  }
}

module.exports.WSSocket = WSSocket;
