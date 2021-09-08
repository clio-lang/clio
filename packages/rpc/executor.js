const { randomId } = require("./common");
const { Sia, DeSia } = require("sializer");
const { TYPES, Buffer } = require("./lib");

const { RESULT, PATH, CALL, GET } = TYPES;

class Executor {
  constructor(transport) {
    this.transport = transport;
    this.isConnected = false;
    this.connect();
    this.promises = new Map();
    this.emitters = new Map();
    this.id = "executor://" + randomId();
    this.packets = 0;
    this.setupSia();
    this.transport.register(this.id, this);
  }
  setupSia() {
    this.sia = new Sia();
    this.desia = new DeSia();
  }
  connect() {
    this.transport.on("message", (packet) => this.onPacket(packet));
    this.transport.on("connect", () => this.onConnect());
    this.transport.connect();
  }
  onConnect() {
    this.isConnected = true;
  }
  serialize(item) {
    return Buffer.from(this.sia.serialize(item));
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  onPacket(packet) {
    const [source, destination, payload] = packet;
    const [id, type, data] = this.deserialize(payload);
    this.promises.get(id).resolve(data);
  }
  call(path, args) {
    const id = this.packets++;
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const payload = this.serialize([id, CALL, args]);
    const packet = this.serialize([this.id, path, payload]);
    this.send(packet);
    return promise;
  }
  getFunction(path) {
    return (...args) => this.call(path, args);
  }
  async getFunctions(path) {
    const id = this.packets++;
    const promise = new Promise((resolve) => {
      this.promises.set(id, { resolve });
    });
    const payload = this.serialize([id, GET, path]);
    const packet = this.serialize([this.id, null, payload]);
    this.send(packet);
    const paths = await promise;
    const fns = {};
    for (const path of paths) {
      fns[path] = this.getFunction(path);
    }
    return fns;
  }
  send(data) {
    if (this.isConnected) {
      this.transport.send(data);
    } else {
      this.transport.on("connect", () => this.transport.send(data));
    }
  }
}

module.exports.Executor = Executor;
