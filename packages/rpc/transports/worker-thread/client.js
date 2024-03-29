import { Buffer } from "../../lib/index.js";
import { EventEmitter } from "../../common.js";
import { desia } from "sializer";

export class Client extends EventEmitter {
  constructor({ parentPort }) {
    super();
    this.parentPort = parentPort;
    this.postMessage = (message) => parentPort.postMessage(message);
    this.parentPort.on("message", (message) => this.onMessage(message));
    this.map = new Map();
  }
  register(id, instance) {
    this.map.set(id, instance);
  }
  connect() {
    this.emit("connect");
  }
  deserialize(buf) {
    return desia(buf);
  }
  onMessage(data) {
    const packet = this.deserialize(Buffer.from(data));
    const dest = this.map.get(packet[1]);
    dest.onPacket(packet);
  }
  send(data) {
    this.postMessage(data, [data.buffer]);
  }
}
