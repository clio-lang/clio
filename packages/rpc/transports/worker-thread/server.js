const { WorkerThreadSocket } = require("./socket");
const { EventEmitter } = require("../../common");
const { Buffer } = require("../../lib");

const { desia } = require("sializer");

class inSocket {
  constructor(socket) {
    this.socket = socket;
  }
  send(buf) {
    this.socket.emit("message", desia(buf));
  }
}

// CLient -> Server socket
class Socket extends EventEmitter {
  constructor(server) {
    super();
    this.socketId = Math.random();
    this.server = server;
    this.inSocket = new inSocket(this);
  }
  register() {}
  connect() {
    this.emit("connect");
  }
  send(packet) {
    this.server.handleIncoming(this.inSocket, packet);
  }
}

class Server extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.ready = false;
  }
  kill() {
    this.workers.forEach((worker) => worker.kill());
  }
  start() {
    this.emit("listening");
    this.ready = true;
  }
  addWorker(worker) {
    const socket = new WorkerThreadSocket(worker);
    this.workers.push(socket);
    socket.on("message", (data) => {
      this.handleIncoming(socket, Buffer.from(data));
    });
  }
  getTransport() {
    return new Socket(this);
  }
  handleIncoming(socket, packet) {
    this.emit("message", socket, packet);
  }
}

module.exports.Server = Server;
