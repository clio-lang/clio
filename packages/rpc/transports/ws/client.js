const WebSocket = require("ws");
const { Server } = require("./server");
const { EventEmitter } = require("../../common");

class Client extends EventEmitter {
  constructor(config) {
    super();
    this.wsConfig = config || Server.defaultWSConfig();
  }
  connect() {
    const { url } = this.wsConfig;
    this.socket = new WebSocket(url);
    this.socket.on("open", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("message", (data) => this.onData(data));
  }
  send(data) {
    this.socket.send(JSON.stringify(data));
  }
  onData(data) {
    const deserialized = JSON.parse(data);
    this.emit("message", deserialized);
  }
}

module.exports.Client = Client;
