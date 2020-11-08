const { randomId } = require("./common");

class Worker {
  constructor(transport) {
    this.transport = transport;
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.handleConnect());
    this.transport.on("error", (error) => this.onError(error));
    this.functions = new Map();
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
    const { instruction, details, id, clientId } = data;
    if (instruction == "call")
      this.handleCallInstruction(details, id, clientId);
  }
  async handleCallInstruction(details, id, clientId) {
    const { path, args } = JSON.parse(details);
    const fn = this.getFn(path);
    const result = await fn(...args);
    this.sendResult(result, id, clientId);
  }
  async sendResult(result, id, clientId) {
    // here we use clientId to serialize Channels
    result = await result;
    const data = {
      instruction: "result",
      details: JSON.stringify({ result }),
      toClient: clientId,
    };
    this.send(data, id);
  }
  send(data, id) {
    this.transport.send({ ...data, clientId: this.id, id });
  }
}

module.exports.Worker = Worker;
