import { Buffer } from "../../lib/index.js";
import { EventEmitter } from "../../common.js";
import { desia } from "sializer";

export class Client extends EventEmitter {
  constructor({ postMessage }) {
    super();
    this.postMessage = postMessage;
    this.map = new Map();
  }
  connect() {
    this.emit("connect");
  }
  register(id, instance) {
    this.map.set(id, instance);
  }
  deserialize(buf) {
    return desia(buf);
  }
  onmessage(event) {
    const packet = this.deserialize(Buffer.from(event.data));
    const dest = this.map.get(packet[1]);
    dest.onPacket(packet);
  }
  send(data) {
    this.postMessage(data, [data.buffer]);
  }
}
