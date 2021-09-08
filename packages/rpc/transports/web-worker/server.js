const { WebWorkerSocket } = require("./socket");
const { EventEmitter } = require("../../common");

const { desia } = require("sializer");

class inSocket {
  constructor(socket) {
    this.socket = socket;
  }
  send(data) {
    this.socket.emit("message", desia(data));
  }
}

class Socket extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.inSocket = new inSocket(this);
  }
  register() {}
  connect() {
    this.emit("connect");
  }
  send(data) {
    this.server.handleIncoming(this.inSocket, data);
  }
}

class Server extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.ready = false;
  }
  start() {
    this.emit("listening");
    this.ready = true;
  }
  addWorker(worker) {
    const socket = new WebWorkerSocket(worker);
    this.workers.push(socket);
    socket.on("message", (data) => this.handleIncoming(socket, data));
  }
  getTransport() {
    return new Socket(this);
  }
  handleIncoming(socket, data) {
    this.emit("message", socket, Buffer.from(data));
  }
}

module.exports.Server = Server;
