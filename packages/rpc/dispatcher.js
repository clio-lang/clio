import { Buffer, TYPES } from "./lib.js";
import { DeSia, desia, sia } from "sializer";

import { EventEmitter } from "./common.js";

const { GET, REGISTER, PATH } = TYPES;

export class Dispatcher extends EventEmitter {
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
    this.desia = new DeSia();
  }
  deserialize(buf) {
    return desia(buf);
  }
  serialize(item) {
    return Buffer.from(sia(item));
  }
  kill() {
    for (const transport of this.transports) {
      if (transport.kill) transport.kill();
    }
  }
  addTransport(transport) {
    this.transports.push(transport);
    transport.on("message", (socket, buf) => this.onMessage(socket, buf));
    transport.start();
  }
  getRouteInfo(packet) {
    this.desia.reset();
    this.desia.buffer = packet;
    this.desia.readInt8();
    this.desia.readInt8();
    const source = this.desia.readBlock();
    const destination = this.desia.readBlock();
    return [source, destination];
  }
  getPayload() {
    return this.desia.readBlock();
  }
  onMessage(socket, packet) {
    const [source, destination] = this.getRouteInfo(packet);
    this.clients.set(source, socket);
    if (!destination) {
      this.routeSelf(socket, source, this.getPayload());
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
    if (type === GET) {
      const paths = [...this.workers.keys()].filter((p) => p.startsWith(data));
      const payload = this.serialize([id, PATH, paths]);
      const packet = this.serialize([null, source, payload]);
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
  schedule(length) {
    this.index = this.index + 1 >= length ? 0 : this.index + 1;
    return this.index;
  }
  getWorker(path) {
    const workers = this.workers.get(path);
    if (!workers) return;
    const index = this.schedule(workers.length);
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
