const readline = require("readline");
const net = require("net");
const { Server } = require("./server");
const { EventEmitter } = require("../../common");

class Client extends EventEmitter {
  constructor(config) {
    super();
    this.ipcConfig = config || Server.defaultIPCConfig();
  }
  connect() {
    this.socket = net.connect(this.ipcConfig.path);
    this.rl = readline.createInterface(this.socket);
    this.rl.on("line", data => this.onData(data));
    this.socket.on("connect", () => this.emit("connect"));
    this.socket.on("error", error => this.emit("error", error));
    this.socket.on("close", () => this.rl.close());
  }
  send(data) {
    this.socket.write(JSON.stringify(data) + "\n");
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

module.exports.Client = Client;
