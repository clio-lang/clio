const { randomId, EventEmitter } = require("./common");

class Executor {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
    this.emitters = new Map();
    this.id = "executor." + randomId(64);
  }
  connect() {
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }
  onConnect() {
    this.isConnected = true;
  }
  deserialize(data) {
    const reviver = (_, value) => {
      if (value && value["@type"] == "EventEmitter") {
        const { id, clientId } = value;
        if (this.emitters.has(id)) return this.emitters.get(id);
        const emitter = new EventEmitter(id);
        const send = (event, ...args) => {
          this.transport.send({
            instruction: "event",
            details: JSON.stringify({ id, event, args }),
            toClient: clientId,
          });
        };
        emitter.on(/.*/, send);
        this.emitters.set(id, { emitter, send });
        return emitter;
      }
      return value;
    };
    return JSON.parse(data, reviver);
  }
  handleData(data) {
    const { id, details, instruction, toClient } = data;
    // TODO: there must be a better way to do this
    if (toClient !== this.id) return;
    const deserialized = this.deserialize(details);
    if (instruction == "result") {
      const { result } = deserialized;
      return this.promises.get(id).resolve(result);
    } else if (instruction == "event") {
      const { id, event, args } = deserialized;
      const { emitter, send } = this.emitters.get(id);
      emitter.emitUnless(send, event, ...args);
    } else if (instruction == "paths") {
      const { paths } = deserialized;
      return this.promises.get(id).resolve(paths);
    }
  }
  call(path, args) {
    const id = randomId(64);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "call",
        details: JSON.stringify({ path, args }),
        clientId: this.id,
        path,
        id,
      });
    if (this.isConnected) send();
    else this.transport.on("connect", send);
    return promise;
  }
  getFunction(path) {
    return (...args) => this.call(path, args);
  }
  async getFunctions(path) {
    const id = randomId(64);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "getPaths",
        details: JSON.stringify({ path }),
        clientId: this.id,
        id,
      });
    if (this.isConnected) send();
    else this.transport.on("connect", send);
    const paths = await promise;
    const fns = {};
    for (const path of paths) fns[path] = this.getFunction(path);
    return fns;
  }
}

module.exports.Executor = Executor;
