const { randomId, EventEmitter } = require("./common");

class Worker {
  constructor(transport) {
    this.transport = transport;
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.handleConnect());
    this.transport.on("error", (error) => this.onError(error));
    this.functions = new Map();
    this.emitters = new Map();
    this.retries = 10;
    this.id = "worker." + randomId(64);
  }
  register({ path, fn }) {
    this.functions.set(path, fn);
  }
  getFn(path) {
    return this.functions.get(path);
  }
  connect() {
    this.transport.connect();
  }
  onError(error) {
    const { code } = error;
    if (code == "ECONNREFUSED") {
      if (!this.retries)
        throw new Error("Out of retries, cannot connect to the server.");
      this.retries--;
      setTimeout(() => this.connect(), 100);
    }
  }
  handleConnect() {
    this.retries = 10;
    const id = randomId(64);
    const paths = [...this.functions.keys()];
    this.send(
      {
        instruction: "registerWorker",
        details: JSON.stringify({ paths }),
      },
      id
    );
  }
  handleData(data) {
    const { instruction, details, id, clientId, toClient } = data;
    // TODO: there must be a better way to do this
    if (toClient !== this.id) return;
    if (instruction == "call")
      this.handleCallInstruction(details, id, clientId);
    else if (instruction == "event")
      this.handleEventInstruction(details, id, clientId);
  }
  async handleCallInstruction(details, id, clientId) {
    const { path, args } = JSON.parse(details);
    const fn = this.getFn(path);
    const result = await fn(...args);
    this.sendResult(result, id, clientId);
  }
  async handleEventInstruction(details, id, clientId) {
    const { id: emitterId, event, args } = JSON.parse(details);
    const { emitter, send } = this.emitters.get(emitterId);
    emitter.emitUnless(send, event, ...args);
  }
  serialize(data, clientId) {
    const replacer = (_, value) => {
      if (value instanceof EventEmitter) {
        const { id } = value;
        const send = (event, ...args) => {
          const data = {
            instruction: "event",
            details: this.serialize({ id, event, args }),
            toClient: clientId,
          };
          this.send(data);
        };
        value.on(/.*/, send);
        this.emitters.set(id, { emitter: value, send });
        // TODO: kill the emitter on client close
        return { "@type": "EventEmitter", clientId: this.id, id };
      }
      return value;
    };
    return JSON.stringify(data, replacer);
  }
  async sendResult(result, id, clientId) {
    result = await result;
    const data = {
      instruction: "result",
      details: this.serialize({ result }, clientId),
      toClient: clientId,
    };
    this.send(data, id);
  }
  send(data, id) {
    this.transport.send({ ...data, clientId: this.id, id });
  }
}

module.exports.Worker = Worker;
