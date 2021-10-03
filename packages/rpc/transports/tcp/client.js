import { Buffer, PacketParser } from "../../lib/index.js";

import { EventEmitter } from "../../common.js";
import { Server } from "./server.js";
import { connect as _connect } from "net";
import { desia } from "sializer";

const header = Buffer.alloc(2);

export class Client extends EventEmitter {
  constructor(config) {
    super();
    this.tcpConfig = config || Server.defaultTCPConfig();
    this.map = new Map();
  }
  register(id, instance) {
    this.map.set(id, instance);
  }
  connect() {
    const { port, host } = this.tcpConfig;
    this.socket = _connect(port, host);
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
