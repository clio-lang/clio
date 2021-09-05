const { EventEmitter } = require("../../common");
const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("../../lib");

const { RESULT, PATH, CALL, GET, REGISTER } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;

class Client extends EventEmitter {
  constructor({ parentPort }) {
    super();
    this.parentPort = parentPort;
    this.postMessage = (message) => parentPort.postMessage(message);
    this.parentPort.on("message", (message) => this.onMessage(message));
    this.setupSia();
    this.map = new Map();
  }
  setupSia() {
    const constructors = [
      {
        constructor: Packet,
        code: PACKET,
        build: (...args) => args,
        args: (item) => [item.source, item.destination, item.payload],
      },
    ];
    this.sia = new Sia({ constructors });
    this.desia = new DeSia({ constructors });
  }
  register(id, instance) {
    this.map.set(id, instance);
  }
  connect() {
    this.emit("connect");
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  onMessage(data) {
    const packet = this.deserialize(Buffer.from(data));
    const dest = this.map.get(packet[1]);
    dest.onPacket(packet);
  }
  send(data) {
    this.postMessage(data);
  }
}

module.exports.Client = Client;
