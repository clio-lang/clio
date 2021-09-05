const { randomId } = require("./common");
const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("./lib");

const { RESULT, PATH, CALL, GET, REGISTER } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;
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
    const payload = this.serialize(new Payload(id, REGISTER, paths));
    const packet = this.serialize(new Packet(this.id, null, payload));
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
    return Buffer.from([...this.sia.serialize(data)]);
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  sendResult(result, id, destination) {
    const payload = this.serialize(new Payload(id, RESULT, result));
    const packet = this.serialize(new Packet(this.id, destination, payload));
    this.send(packet);
  }
  send(data) {
    this.transport.send(data);
  }
}

module.exports.Worker = Worker;
