const { randomId } = require("./common");
const { Sia, DeSia } = require("sializer");
const { TYPES, Buffer } = require("./lib");

const { RESULT, CALL, REGISTER } = TYPES;
class Worker {
  constructor(transport) {
    this.transport = transport;
    this.transport.on("message", (packet) => this.onPacket(packet));
    this.transport.on("connect", () => this.handleConnect());
    this.transport.on("error", (error) => this.onError(error));
    this.functions = new Map();
    this.emitters = new Map();
    this.retries = 10;
    this.id = "worker://" + randomId(64);
    this.setupSia();
    this.packets = 0;
    this.transport.register(this.id, this);
  }
  setupSia() {
    this.sia = new Sia();
    this.desia = new DeSia();
  }
  register({ path, fn }) {
    this.transport.register(path, this);
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
    const id = this.packets++;
    const paths = [...this.functions.keys()];
    const payload = this.serialize([id, REGISTER, paths]);
    const packet = this.serialize([this.id, null, payload]);
    this.send(packet);
  }
  onPacket(packet) {
    const [source, destination, payload] = packet;
    const [id, type, data] = this.deserialize(payload);
    if (type === CALL) {
      this.handleCallInstruction(destination, data, id, source);
    }
  }
  async handleCallInstruction(path, data, id, source) {
    const fn = this.getFn(path);
    const result = await fn(...data);
    this.sendResult(result, id, source);
  }
  serialize(data) {
    return Buffer.from(this.sia.serialize(data));
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  sendResult(result, id, destination) {
    const payload = this.serialize([id, RESULT, result]);
    const packet = this.serialize([this.id, destination, payload]);
    this.send(packet);
  }
  send(data) {
    this.transport.send(data);
  }
}

module.exports.Worker = Worker;
