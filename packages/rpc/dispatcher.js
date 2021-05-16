const { EventEmitter } = require("./common");

class Dispatcher extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.clients = new Map();
    this.jobs = new Map();
    this.rr = new Map();
    this.connectedWorkers = [];
    this.transports = [];
    this.index = 0;
  }
  kill() {
    this.transports.forEach((transport) => {
      if (transport.kill) transport.kill();
    });
  }
  addTransport(transport) {
    this.transports.push(transport);
    transport.on("message", (...args) => this.handleTransportMessage(...args));
    transport.start();
  }
  handleTransportMessage(socket, data) {
    const { instruction, details, id, clientId, ...rest } = JSON.parse(data);
    this.clients.set(clientId, socket);
    const args = [socket, details, id, clientId, rest];
    if (instruction == "call") this.call(...args);
    else if (instruction == "result") this.result(...args);
    else if (instruction == "getPaths") this.getPaths(...args);
    else if (instruction == "registerWorker") this.registerWorker(...args);
    else if (instruction == "event") this.event(...args);
  }
  event(inSocket, details, id, clientId, { toClient }) {
    const socket = this.clients.get(toClient);
    this.send(
      socket,
      { instruction: "event", details, clientId, toClient },
      id
    );
  }
  call(socket, details, id, clientId, { path }) {
    const worker = this.getWorker(path);
    if (worker) {
      const toClient = worker.clientId;
      this.send(
        worker,
        {
          instruction: "call",
          details,
          clientId,
          toClient,
        },
        id
      );
    } else {
      this.addJob(socket, details, id, clientId, { path });
    }
  }
  result(inSocket, details, id, clientId, { toClient }) {
    const socket = this.clients.get(toClient);
    this.send(
      socket,
      { instruction: "result", details, clientId, toClient },
      id
    );
  }
  getPaths(socket, details, id, clientId) {
    const { path } = JSON.parse(details);
    const paths = [...this.workers.keys()].filter((p) => p.startsWith(path));
    this.send(
      socket,
      {
        instruction: "paths",
        details: JSON.stringify({ paths }),
        clientId,
        toClient: clientId,
      },
      id
    );
  }
  registerWorker(worker, details, id, clientId) {
    const { paths } = JSON.parse(details);
    if (!paths.length) return;
    // TODO: there must be a better way to do this
    worker.clientId = clientId;
    for (const path of paths)
      this.workers.set(path, [...(this.workers.get(path) || []), worker]);
    for (const path of paths) {
      const jobs = this.jobs.get(path) || [];
      this.jobs.set(path, []);
      for (const job of jobs) this.call(...job);
    }
    this.connectedWorkers.push(worker);
    const listeners = this.listeners.workerConnected || [];
    listeners.forEach((fn) => fn.call(this, worker));
  }
  addJob(socket, details, id, clientId, path) {
    this.jobs.set(path, [
      ...(this.jobs.get(path) || []),
      [socket, details, id, clientId, path],
    ]);
  }
  schedule(path, length) {
    const stored = this.rr.get(path);
    const curr = Number.isInteger(stored) ? stored : 0;
    const next = curr + 1 >= length ? 0 : curr + 1;
    this.rr.set(path, next);
    return next;
  }
  getWorker(path) {
    const workers = this.workers.get(path);
    if (!workers) return;
    const index = this.schedule(path, workers.length);
    return workers[index];
  }
  send(socket, data, id) {
    socket.send({ ...data, id });
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
