const { randomId } = require("./common");
const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("./lib");

const { RESULT, PATH, CALL, GET } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;

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
    const payload = this.serialize(new Payload(id, CALL, args));
    const packet = this.serialize(new Packet(this.id, path, payload));
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
    const payload = this.serialize(new Payload(id, GET, path));
    const packet = this.serialize(new Packet(this.id, null, payload));
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
