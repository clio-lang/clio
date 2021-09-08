const { PacketParser } = require("../../lib");
const { desia } = require("sializer");
const net = require("net");
const { Server } = require("./server");
const { EventEmitter } = require("../../common");
const { Buffer } = require("../../lib");

const header = Buffer.alloc(2);

class Client extends EventEmitter {
  constructor(config) {
    super();
    this.ipcConfig = config || Server.defaultIPCConfig();
    this.map = new Map();
  }
  register(id, instance) {
    this.map.set(id, instance);
  }
  connect() {
    this.socket = net.connect(this.ipcConfig.path);
    this.parser = new PacketParser(this.socket);
    this.parser.on("message", (data) => this.onMessage(data));
    this.socket.on("connect", () => this.emit("connect"));
    this.socket.on("error", (error) => this.emit("error", error));
  }
  send(data) {
    header.writeUInt16LE(data.length, 0);
    this.socket.write(Buffer.from(header));
    this.socket.write(data);
  }
  deserialize(buf) {
    return desia(buf);
  }
  onMessage(data) {
    const packet = this.deserialize(data);
    const dest = this.map.get(packet[1]);
    dest.onPacket(packet);
  }
}

module.exports.Client = Client;
