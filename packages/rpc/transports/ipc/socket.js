const readline = require("readline");
const { EventEmitter } = require("../../common");

class IPCSocket extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.socket.rl = readline.createInterface(this.socket);
    this.socket.rl.on("line", data => this.onData(data));
    this.socket.on("close", () => this.socket.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

module.exports.IPCSocket = IPCSocket;
