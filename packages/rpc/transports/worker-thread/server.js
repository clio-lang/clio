const { WorkerThreadSocket } = require("./socket");
const { EventEmitter } = require("../../common");

class WrappedWorkerThread extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.worker.on("message", message => this.emit("message", message));
  }
  postMessage(message) {
    this.worker.postMessage(message);
  }
  kill() {
    this.worker.terminate();
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
    this.server.handleIncoming(this.inSocket, data);
  }
}

class Server extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.messageIds = new Map();
    this.ready = false;
  }
  kill() {
    this.workers.forEach(worker => worker.kill());
  }
  start() {
    this.emit("listening");
    this.ready = true;
  }
  addWorker(worker) {
    const wrappedWorker = new WrappedWorkerThread(worker);
    const socket = new WorkerThreadSocket(wrappedWorker);
    this.workers.push(wrappedWorker);
    wrappedWorker.on("message", data => {
      this.handleIncoming(socket, data);
    });
  }
  getTransport() {
    return new Socket(this);
  }
  handleIncoming(socket, data) {
    const { instruction, details, id } = data;
    this.emit(instruction, socket, details, id);
  }
}

module.exports.Server = Server;
