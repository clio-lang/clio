import { Buffer } from "../../lib/index.js";
import { EventEmitter } from "../../common.js";
import { Server } from "./server.js";
import WebSocket from "ws";
import { desia } from "sializer";

export class Client extends EventEmitter {
  constructor(config) {
    super();
    this.wsConfig = config || Server.defaultWSConfig();
    this.map = new Map();
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
    return desia(buf);
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
