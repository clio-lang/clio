const { randomId } = require("./common");

class Executor {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
  }
  connect() {
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }
  onConnect() {
    this.isConnected = true;
  }
  handleData(data) {
    const { id, details, instruction } = data;
    if (instruction == "result") {
      const { result } = details;
      return this.promises.get(id).resolve(result);
    } else if (instruction == "paths") {
      const { paths } = details;
      return this.promises.get(id).resolve(paths);
    }
  }
  call(path, args) {
    const id = randomId(32);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "call",
        details: { path, args },
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
    const id = randomId(32);
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const send = () =>
      this.transport.send({
        instruction: "getPaths",
        details: { path },
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
