const { EventEmitter } = require("./common");
const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("./lib");

const { PATH, REGISTER } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;

class Dispatcher extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.clients = new Map();
    this.jobs = new Map();
    this.connectedWorkers = [];
    this.transports = [];
    this.index = 0;
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
      {
        constructor: Payload,
        code: PAYLOAD,
        build: (...args) => args,
        args: (item) => [item.id, item.type, item.data],
      },
    ];
    this.sia = new Sia({ constructors });
    this.desia = new DeSia({ constructors });
  }
  deserialize(buf) {
    const result = this.desia.deserialize(buf);
    return result;
  }
  serialize(item) {
    return Buffer.from(this.sia.serialize(item));
  }
  kill() {
    for (const transport of this.transports) {
      transport.kill?.();
    }
  }
  addTransport(transport) {
    this.transports.push(transport);
    transport.on("message", (socket, buf) => this.onMessage(socket, buf));
    transport.start();
  }
  onMessage(socket, packet) {
    const [source, destination, payload] = this.deserialize(packet);
    this.clients.set(source, socket);
    if (!destination) {
      this.routeSelf(socket, source, payload);
    } else if (destination.startsWith("worker://")) {
      this.routeToSocket(destination, packet);
    } else if (destination.startsWith("executor://")) {
      this.routeToSocket(destination, packet);
    } else {
      this.routePath(destination, packet);
    }
  }
  routeToSocket(destination, packet) {
    const socket = this.clients.get(destination);
    if (socket) {
      socket.send(packet);
    }
  }
  routePath(path, packet) {
    const worker = this.getWorker(path);
    if (worker) {
      worker.send(packet);
    } else {
      this.addJob(path, packet);
    }
  }
  routeSelf(socket, source, payload) {
    const [id, type, data] = this.deserialize(payload);
    if (type === PATH) {
      const paths = [...this.workers.keys()].filter((p) => p.startsWith(data));
      const payload = this.serialize(new Payload(id, type, paths));
      const packet = this.serialize(new Packet(null, source, payload));
      socket.send(packet);
    } else if (type === REGISTER) {
      if (!data.length) return;
      for (const path of data) {
        const currentWorkers = this.workers.get(path) || [];
        this.workers.set(path, [...currentWorkers, socket]);
      }
      for (const path of data) {
        const jobs = this.jobs.get(path) || [];
        this.jobs.set(path, []);
        for (const job of jobs) {
          this.routePath(...job);
        }
      }
      this.connectedWorkers.push(socket);
      const listeners = this.listeners.workerConnected || [];
      listeners.forEach((fn) => fn.call(this, socket));
    }
  }
  addJob(...args) {
    const currentJobs = this.jobs.get(path) || [];
    this.jobs.set(path, [...currentJobs, args]);
  }
  random(high) {
    return Math.round(Math.random() * high);
  }
  getWorker(path) {
    const workers = this.workers.get(path);
    if (!workers) return;
    const index = this.random(workers.length - 1);
    return workers[index];
  }
  expectWorkers(n) {
    return new Promise((resolve) => {
      if (this.connectedWorkers.length >= n) resolve();
      const waitForN = () => {
        const { length } = this.connectedWorkers;
        if (length >= n) {
          this.off("workerConnected", waitForN);
          resolve();
        }
      };
      this.on("workerConnected", waitForN);
    });
  }
}

module.exports.Dispatcher = Dispatcher;
