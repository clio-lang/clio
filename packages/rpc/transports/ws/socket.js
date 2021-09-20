const { EventEmitter } = require("../../common");

class WSSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
  }
  send(data) {
    this.socket.send(data);
  }
}

module.exports.WSSocket = WSSocket;
