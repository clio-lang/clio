const { randomId } = require("./common");

class Worker {
  constructor(transport) {
    this.transport = transport;
    this.transport.on("message", (data) => this.handleData(data));
    this.transport.on("connect", () => this.handleConnect());
    this.transport.on("error", (error) => this.onError(error));
    this.functions = new Map();
    this.retries = 10;
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
    const id = randomId(32);
    const paths = [...this.functions.keys()];
    this.send(
      {
        instruction: "registerWorker",
        details: { paths },
      },
      id
    );
  }
  handleData(data) {
    const { instruction, details, id } = data;
    if (instruction == "call") this.handleCallInstruction(details, id);
  }
  async handleCallInstruction(details, id) {
    const { path, args } = details;
    const fn = this.getFn(path);
    const result = await fn(...args);
    this.sendResult(result, id);
  }
  async sendResult(result, id) {
    result = await result;
    const data = { instruction: "result", details: { result } };
    this.send(data, id);
  }
  send(data, id) {
    this.transport.send({ ...data, id });
  }
}

module.exports.Worker = Worker;
