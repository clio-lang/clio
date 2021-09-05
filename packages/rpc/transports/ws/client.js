const WebSocket = require("ws");
const { Server } = require("./server");
const { EventEmitter } = require("../../common");
const { Sia, DeSia } = require("sializer");
const { Payload, Packet, TYPES, SIA_TYPES } = require("../../lib");

const { RESULT, PATH, CALL, GET, REGISTER } = TYPES;
const { PACKET, PAYLOAD } = SIA_TYPES;

class Client extends EventEmitter {
  constructor(config) {
    super();
    this.wsConfig = config || Server.defaultWSConfig();
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
    const { url } = this.wsConfig;
    this.socket = new WebSocket(url);
    this.socket.on("open", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("message", (data) => this.onData(data));
  }
  deserialize(buf) {
    return this.desia.deserialize(buf);
  }
  send(data) {
    this.socket.send(data);
  }
  onData(data) {
    const packet = this.deserialize(Buffer.from(data));
    const dest = this.map.get(packet[1]);
    dest.onPacket(packet);
  }
}

module.exports.Client = Client;
