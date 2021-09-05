const { WorkerThreadSocket } = require("./socket");
const { EventEmitter } = require("../../common");

const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("../../lib");

const { RESULT, PATH, CALL, GET, REGISTER } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;

class inSocket {
  constructor(socket) {
    this.socket = socket;
    this.setupSia();
  }
  setupSia() {
    const constructors = [
      {
        constructor: Packet,
        code: PACKET,
        build: (...args) => args,
        args: (item) => [item.source, item.destination, item.payload],
      },
    ];
    this.sia = new Sia({ constructors });
    this.desia = new DeSia({ constructors });
  }
  send(buf) {
    const packet = this.desia.deserialize(buf);
    this.socket.emit("message", packet);
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
