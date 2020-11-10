const { WebWorkerSocket } = require("./socket");
const { EventEmitter } = require("../../common");

class WrappedWebWorker extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.worker.onmessage = (event) => this.emit("message", event.data);
  }
  postMessage(message) {
    this.worker.postMessage(message);
  }
}

class inSocket {
  constructor(socket) {
    this.socket = socket;
  }
  send(data) {
    this.socket.emit("message", data);
  }
}

class Socket extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.inSocket = new inSocket(this);
  }
  connect() {
    this.emit("connect");
  }
  send(data) {
    this.server.handleIncoming(this.inSocket, JSON.stringify(data));
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
    const wrappedWorker = new WrappedWebWorker(worker);
    const socket = new WebWorkerSocket(wrappedWorker);
    this.workers.push(wrappedWorker);
    wrappedWorker.on("message", (data) => this.handleIncoming(socket, data));
  }
  getTransport() {
    return new Socket(this);
  }
  handleIncoming(socket, data) {
    this.emit("message", socket, data);
  }
}

module.exports.Server = Server;
